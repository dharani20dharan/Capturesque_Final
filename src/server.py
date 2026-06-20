from flask import Flask, jsonify, send_file, abort, request, send_from_directory
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity as _get_jwt_identity
import os
import shutil
from mimetypes import guess_type
from werkzeug.utils import secure_filename
from functools import wraps
from dotenv import load_dotenv
import json
from datetime import datetime, timedelta

def get_jwt_identity():
    val = _get_jwt_identity()
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return val
    return val

# Load env
load_dotenv()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if not os.getenv("JWT_SECRET_KEY"):
    load_dotenv(os.path.join(BASE_DIR, ".env"))
if not os.getenv("JWT_SECRET_KEY"):
    load_dotenv(os.path.join(os.path.dirname(BASE_DIR), ".env"))

app = Flask(__name__)

# Config
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///site.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024  # 100MB upload limit

@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

JWT_SECRET = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET_KEY is not set in environment. Please create a .env file.")
app.config["JWT_SECRET_KEY"] = JWT_SECRET
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=int(os.getenv("JWT_EXPIRE_HOURS", "1")))

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "dharani080905@gmail.com")

raw_images_path = os.getenv("IMAGES_PATH", "./Images")
if not os.path.isabs(raw_images_path):
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    BASE_PATH = os.path.abspath(os.path.join(project_root, raw_images_path))
else:
    BASE_PATH = os.path.abspath(raw_images_path)

os.makedirs(BASE_PATH, exist_ok=True)
ALLOWED_EXTENSIONS = set(os.getenv("ALLOWED_EXTENSIONS", "png,jpg,jpeg,gif,mp4,mov,avi,mkv,webm").split(","))

# CORS Origins
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://34.93.13.211:8087",      # GCP deployed frontend/media
    "http://34.93.13.211",           # GCP deployed frontend default HTTP
    "http://150.230.138.173:8087",  # Old Oracle VM IP (backward compatibility)
]
env_origins = os.getenv("CORS_ALLOWED_ORIGINS")
if env_origins:
    allowed_origins.extend([o.strip() for o in env_origins.split(",") if o.strip()])

CORS(
    app,
    supports_credentials=True,
    resources={r"/*": {"origins": allowed_origins}},
)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default="user") # admin, photographer, user
    security_question = db.Column(db.String(255), nullable=True)
    security_answer = db.Column(db.String(255), nullable=True)
    failed_login_attempts = db.Column(db.Integer, default=0)
    lockout_until = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f"<User {self.email}>"

class ActivityLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user_email = db.Column(db.String(120), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    details = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class ClubMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    photo = db.Column(db.String(255), nullable=True)
    quote = db.Column(db.Text, nullable=True)
    instagram = db.Column(db.String(100), nullable=True)
    insta_link = db.Column(db.String(255), nullable=True)
    role_type = db.Column(db.String(50), default="poc") # head, core, poc
    display_order = db.Column(db.Integer, default=0)

    def __repr__(self):
        return f"<ClubMember {self.name}>"

# Startup logic & schema migrations
with app.app_context():
    db.create_all()
    # Migration: add columns if they do not exist in sqlite 'user' table
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    columns = [col['name'] for col in inspector.get_columns('user')]
    
    with db.engine.begin() as conn:
        if 'role' not in columns:
            conn.execute(db.text("ALTER TABLE user ADD COLUMN role VARCHAR(20) DEFAULT 'user'"))
        if 'security_question' not in columns:
            conn.execute(db.text("ALTER TABLE user ADD COLUMN security_question VARCHAR(255)"))
        if 'security_answer' not in columns:
            conn.execute(db.text("ALTER TABLE user ADD COLUMN security_answer VARCHAR(255)"))
        if 'failed_login_attempts' not in columns:
            conn.execute(db.text("ALTER TABLE user ADD COLUMN failed_login_attempts INTEGER DEFAULT 0"))
        if 'lockout_until' not in columns:
            conn.execute(db.text("ALTER TABLE user ADD COLUMN lockout_until DATETIME"))
    
    # Ensure primary admin user exists and has 'admin' role in database
    admin_user = User.query.filter_by(email=ADMIN_EMAIL.lower()).first()
    if not admin_user:
        hashed_password = bcrypt.generate_password_hash("Admin@123").decode("utf-8")
        hashed_answer = bcrypt.generate_password_hash("blue").decode("utf-8")
        admin_user = User(
            email=ADMIN_EMAIL.lower(),
            password=hashed_password,
            role="admin",
            security_question="What is your favorite color?",
            security_answer=hashed_answer,
            failed_login_attempts=0
        )
        db.session.add(admin_user)
        db.session.commit()
        print(f"Startup: Seeded primary admin user ({ADMIN_EMAIL}) with password 'Admin@123' and security answer 'blue'.")
    elif admin_user.role != 'admin':
        admin_user.role = 'admin'
        db.session.commit()
        print(f"Startup: Promoted primary admin user ({ADMIN_EMAIL}) to 'admin' role in database.")

    # Create dynamic subfolders inside BASE_PATH
    os.makedirs(os.path.join(BASE_PATH, 'Members'), exist_ok=True)
    os.makedirs(os.path.join(BASE_PATH, 'Hero'), exist_ok=True)
    os.makedirs(os.path.join(BASE_PATH, 'Feature'), exist_ok=True)

    # Seed default club members if database is empty
    if ClubMember.query.count() == 0:
        default_members = [
            # Club Heads
            {"name": "Dharanidharan", "photo": "/Members/member1.jpg", "quote": "Photography is the story I fail to put into words.", "instagram": "@this_is_dharanidharan", "insta_link": "https://www.instagram.com/this_is_dharanidharan", "role_type": "head", "display_order": 1},
            {"name": "Another Club Head", "photo": "/images/avatar_placeholder.png", "quote": "Every picture tells a story, let's capture it.", "instagram": "@another_clubhead", "insta_link": "https://www.instagram.com/another_clubhead", "role_type": "head", "display_order": 2},
            
            # Core Committee
            {"name": "Core Member 2", "photo": "/images/avatar_placeholder.png", "quote": "A picture is worth a thousand words.", "instagram": "@core2", "insta_link": "https://www.instagram.com/core2", "role_type": "core", "display_order": 3},
            {"name": "Core Member 3", "photo": "/images/avatar_placeholder.png", "quote": "Finding beauty in the ordinary.", "instagram": "@core3", "insta_link": "https://www.instagram.com/core3", "role_type": "core", "display_order": 4},
            {"name": "Core Member 4", "photo": "/images/avatar_placeholder.png", "quote": "Moments captured, memories preserved.", "instagram": "@core4", "insta_link": "https://www.instagram.com/core4", "role_type": "core", "display_order": 5},
            {"name": "Core Member 5", "photo": "/images/avatar_placeholder.png", "quote": "Chasing light, capturing life.", "instagram": "@core5", "insta_link": "https://www.instagram.com/core5", "role_type": "core", "display_order": 6},
            {"name": "Core Member 6", "photo": "/images/avatar_placeholder.png", "quote": "Through the lens, we see the world differently.", "instagram": "@core6", "insta_link": "https://www.instagram.com/core6", "role_type": "core", "display_order": 7},
            
            # POC Members
            {"name": "POC Member 1", "photo": "/images/avatar_placeholder.png", "quote": "", "instagram": "@poc1", "insta_link": "https://www.instagram.com/poc1", "role_type": "poc", "display_order": 8},
            {"name": "POC Member 2", "photo": "/images/avatar_placeholder.png", "quote": "", "instagram": "@poc2", "insta_link": "https://www.instagram.com/poc2", "role_type": "poc", "display_order": 9},
            {"name": "POC Member 3", "photo": "/images/avatar_placeholder.png", "quote": "", "instagram": "@poc3", "insta_link": "https://www.instagram.com/poc3", "role_type": "poc", "display_order": 10},
            {"name": "POC Member 4", "photo": "/images/avatar_placeholder.png", "quote": "", "instagram": "@poc4", "insta_link": "https://www.instagram.com/poc4", "role_type": "poc", "display_order": 11},
            {"name": "POC Member 5", "photo": "/images/avatar_placeholder.png", "quote": "", "instagram": "@poc5", "insta_link": "https://www.instagram.com/poc5", "role_type": "poc", "display_order": 12},
            {"name": "POC Member 6", "photo": "/images/avatar_placeholder.png", "quote": "", "instagram": "@poc6", "insta_link": "https://www.instagram.com/poc6", "role_type": "poc", "display_order": 13},
            {"name": "POC Member 7", "photo": "/images/avatar_placeholder.png", "quote": "", "instagram": "@poc7", "insta_link": "https://www.instagram.com/poc7", "role_type": "poc", "display_order": 14},
            {"name": "POC Member 8", "photo": "/images/avatar_placeholder.png", "quote": "", "instagram": "@poc8", "insta_link": "https://www.instagram.com/poc8", "role_type": "poc", "display_order": 15},
            {"name": "POC Member 9", "photo": "/images/avatar_placeholder.png", "quote": "", "instagram": "@poc9", "insta_link": "https://www.instagram.com/poc9", "role_type": "poc", "display_order": 16},
            {"name": "POC Member 10", "photo": "/images/avatar_placeholder.png", "quote": "", "instagram": "@poc10", "insta_link": "https://www.instagram.com/poc10", "role_type": "poc", "display_order": 17},
        ]
        for m in default_members:
            member = ClubMember(
                name=m["name"],
                photo=m["photo"],
                quote=m["quote"],
                instagram=m["instagram"],
                insta_link=m["insta_link"],
                role_type=m["role_type"],
                display_order=m["display_order"]
            )
            db.session.add(member)
        db.session.commit()
        print("Startup: Seeded default club members in database.")

# Helper Functions
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def normalize_parts_from_path(path: str):
    parts = [p for p in path.split('/') if p]
    return [secure_filename(p) for p in parts]

def safe_join_base(*parts):
    candidate = os.path.join(BASE_PATH, *parts) if parts else BASE_PATH
    base_abs = os.path.abspath(BASE_PATH)
    target_abs = os.path.abspath(candidate)
    if not target_abs.startswith(base_abs + os.sep) and target_abs != base_abs:
        raise ValueError("Invalid path")
    return candidate

def make_identity(user):
    is_admin = (user.email.lower() == ADMIN_EMAIL.lower() or user.role == 'admin')
    role = "admin" if is_admin else user.role
    return {"id": user.id, "email": user.email, "is_admin": is_admin, "role": role}

def create_token_for_user(user):
    identity = make_identity(user)
    access_token = create_access_token(identity=json.dumps(identity))
    return access_token, identity

def log_activity(action, details=None):
    try:
        identity = get_jwt_identity() or {}
        user_id = identity.get('id')
        user_email = identity.get('email')
        if user_id and user_email:
            log_entry = ActivityLog(
                user_id=user_id,
                user_email=user_email,
                action=action,
                details=details
            )
            db.session.add(log_entry)
            db.session.commit()
    except Exception as e:
        print(f"Logging error: {str(e)}")

def validate_password_strength(password):
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit."
    special_characters = "!@#$%^&*()-_=+[{]};:'\",<.>/?\\|"
    if not any(c in special_characters for c in password):
        return False, "Password must contain at least one special character (e.g. !, @, #, $, %, etc.)."
    return True, ""

# Route Protection Decorators
def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200
        identity = get_jwt_identity() or {}
        if not (identity.get('is_admin') or identity.get('role') == 'admin'):
            return jsonify({'error': 'Admin access required'}), 403
        return fn(*args, **kwargs)
    return wrapper

def photographer_or_admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200
        identity = get_jwt_identity() or {}
        role = identity.get('role')
        is_admin = identity.get('is_admin')
        if not (is_admin or role in ('admin', 'photographer')):
            return jsonify({'error': 'Photographer or Admin access required'}), 403
        return fn(*args, **kwargs)
    return wrapper

# Auth Routes
@app.route("/register", methods=["POST", "OPTIONS"])
def register():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    security_question = data.get("securityQuestion")
    security_answer = data.get("securityAnswer")

    if not email or not password or not security_question or not security_answer:
        return jsonify({"success": False, "message": "Email, password, security question and answer are required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"success": False, "message": "Email already registered"}), 400

    # Validate password complexity
    is_strong, pass_err = validate_password_strength(password)
    if not is_strong:
        return jsonify({"success": False, "message": pass_err}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
    hashed_answer = bcrypt.generate_password_hash(security_answer.strip().lower()).decode("utf-8")
    role = "admin" if email == ADMIN_EMAIL.lower() else "user"
    user = User(
        email=email,
        password=hashed_password,
        role=role,
        security_question=security_question,
        security_answer=hashed_answer
    )
    db.session.add(user)
    db.session.commit()

    try:
        token, identity = create_token_for_user(user)
        return (
            jsonify({"success": True, "message": "Registration successful.", "token": token, "access_token": token, "accessToken": token, "user": identity}),
            201,
        )
    except Exception:
        return jsonify({"success": True, "message": "Registration successful. Please log in."}), 201

@app.route("/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    # Check lockout
    if user.lockout_until and user.lockout_until > datetime.utcnow():
        remaining = int((user.lockout_until - datetime.utcnow()).total_seconds())
        minutes = (remaining // 60) + 1
        return jsonify({
            "success": False,
            "message": f"Account is locked due to multiple failed login attempts. Try again in {minutes} minute(s)."
        }), 423

    # Check password matches
    if not bcrypt.check_password_hash(user.password, password):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= 5:
            user.lockout_until = datetime.utcnow() + timedelta(minutes=5)
            db.session.commit()
            return jsonify({
                "success": False,
                "message": "Too many failed attempts. Account has been locked for 5 minutes."
            }), 423
        else:
            db.session.commit()
            remaining_attempts = 5 - user.failed_login_attempts
            return jsonify({
                "success": False,
                "message": f"Invalid email or password. {remaining_attempts} attempt(s) remaining before lockout."
            }), 401

    # Success: reset lockout
    user.failed_login_attempts = 0
    user.lockout_until = None
    db.session.commit()

    token, identity = create_token_for_user(user)
    return (
        jsonify({"success": True, "token": token, "access_token": token, "accessToken": token, "user": identity}),
        200,
    )

@app.route("/api/auth/social-login", methods=["POST", "OPTIONS"])
def social_login():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    provider = data.get("provider")
    
    if not email or not provider:
        return jsonify({"success": False, "message": "Email and provider are required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        # Create user automatically for social SSO
        placeholder_pass = bcrypt.generate_password_hash("SocialPass!123").decode("utf-8")
        placeholder_answer = bcrypt.generate_password_hash("social").decode("utf-8")
        role = "admin" if email == ADMIN_EMAIL.lower() else "user"
        user = User(
            email=email,
            password=placeholder_pass,
            role=role,
            security_question="Social sign-in provider",
            security_answer=placeholder_answer,
            failed_login_attempts=0
        )
        db.session.add(user)
        db.session.commit()
    else:
        # Ensure role is admin if it matches ADMIN_EMAIL
        if email == ADMIN_EMAIL.lower() and user.role != "admin":
            user.role = "admin"
            db.session.commit()

    # Success: reset lockout
    user.failed_login_attempts = 0
    user.lockout_until = None
    db.session.commit()

    token, identity = create_token_for_user(user)
    log_activity("social_login", f"User logged in via {provider}")
    
    return (
        jsonify({"success": True, "token": token, "access_token": token, "accessToken": token, "user": identity}),
        200,
    )

@app.route("/api/auth/forgot-password", methods=["POST", "OPTIONS"])
def forgot_password():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"success": False, "message": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"success": False, "message": "Email not found"}), 404

    if not user.security_question:
        return jsonify({"success": False, "message": "This account does not have a security question configured."}), 400

    return jsonify({"success": True, "question": user.security_question}), 200

@app.route("/api/auth/reset-password", methods=["POST", "OPTIONS"])
def reset_password():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    security_answer = data.get("answer", "").strip().lower()
    new_password = data.get("newPassword")

    if not email or not security_answer or not new_password:
        return jsonify({"success": False, "message": "Email, security answer and new password are required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    if not user.security_answer:
        return jsonify({"success": False, "message": "No security answer configured for this account."}), 400

    # Check answer matches
    if not bcrypt.check_password_hash(user.security_answer, security_answer):
        return jsonify({"success": False, "message": "Incorrect answer to security question."}), 400

    # Validate password complexity
    is_strong, pass_err = validate_password_strength(new_password)
    if not is_strong:
        return jsonify({"success": False, "message": pass_err}), 400

    # Reset password
    hashed_password = bcrypt.generate_password_hash(new_password).decode("utf-8")
    user.password = hashed_password
    user.failed_login_attempts = 0
    user.lockout_until = None
    db.session.commit()

    try:
        log_entry = ActivityLog(
            user_id=user.id,
            user_email=user.email,
            action="password_reset",
            details="Password reset via security question answer."
        )
        db.session.add(log_entry)
        db.session.commit()
    except Exception as e:
        print(f"Logging error during password reset: {e}")

    return jsonify({"success": True, "message": "Password reset successful. Please log in with your new password."}), 200

@app.route("/auth/verify", methods=["GET"])
@jwt_required()
def verify_token():
    identity = get_jwt_identity() or {}
    user = User.query.get(identity.get('id'))
    if user:
        identity = make_identity(user)
    return jsonify({"valid": True, "user": identity}), 200

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

# Media/Gallery Routes
@app.route('/api/images', methods=['GET'])
def get_folders():
    try:
        folders = [f for f in os.listdir(BASE_PATH) if os.path.isdir(os.path.join(BASE_PATH, f))]
        return jsonify({'folders': folders})
    except Exception as e:
        return jsonify({'error': f'Failed to fetch folders: {str(e)}'}), 500

@app.route('/api/images/<path:foldername>', methods=['GET'])
def get_all_images_recursive(foldername):
    try:
        parts = normalize_parts_from_path(foldername)
        base_folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    if not os.path.exists(base_folder_path) or not os.path.isdir(base_folder_path):
        return jsonify({'error': 'Folder not found'}), 404

    try:
        images = []
        base_url = request.url_root.rstrip('/')
        for root, _, files in os.walk(base_folder_path):
            for file in files:
                if not allowed_file(file):
                    continue
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, BASE_PATH)
                rel_folder = os.path.dirname(rel_path).replace('\\', '/')
                rel_parts = [secure_filename(p) for p in rel_folder.split('/') if p]
                encoded_rel_folder = '/'.join(rel_parts)
                filename = secure_filename(file)

                if encoded_rel_folder:
                    image_url = f"{base_url}/api/image/{encoded_rel_folder}/{filename}"
                    download_url = f"{base_url}/api/download/{encoded_rel_folder}/{filename}"
                else:
                    image_url = f"{base_url}/api/image/{filename}"
                    download_url = f"{base_url}/api/download/{filename}"

                images.append({
                    'id': filename,
                    'name': filename,
                    'url': image_url,
                    'thumbnail': image_url,
                    'download': download_url,
                })
        return jsonify(images), 200
    except Exception as e:
        return jsonify({'error': f'Failed to fetch images: {str(e)}'}), 500

@app.route('/api/folders/<path:parent_folder>', methods=['GET'])
def get_subfolders(parent_folder):
    try:
        parts = normalize_parts_from_path(parent_folder)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
        return jsonify({'error': 'Folder not found'}), 404

    try:
        subfolders = [sf for sf in os.listdir(folder_path) if os.path.isdir(os.path.join(folder_path, sf))]
        return jsonify({'subfolders': subfolders})
    except Exception as e:
        return jsonify({'error': f'Failed to fetch subfolders: {str(e)}'}), 500

@app.route('/api/folders/<path:foldername>', methods=['DELETE', 'OPTIONS'])
@photographer_or_admin_required
def delete_folder(foldername):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    try:
        parts = normalize_parts_from_path(foldername)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    base_abs = os.path.abspath(BASE_PATH)
    target_abs = os.path.abspath(folder_path)

    if target_abs == base_abs:
        return jsonify({'error': 'Cannot delete base directory'}), 400

    if not os.path.exists(target_abs) or not os.path.isdir(target_abs):
        return jsonify({'error': 'Folder not found'}), 404

    try:
        shutil.rmtree(target_abs)
        log_activity("delete_folder", details=foldername)
        return jsonify({'message': 'Folder deleted'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to delete folder: {str(e)}'}), 500

# Public Serve Image
@app.route('/api/image/<path:foldername>/<filename>', methods=['GET'])
def get_image(foldername, filename):
    try:
        parts = normalize_parts_from_path(foldername)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    file_path = os.path.join(folder_path, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'Image not found'}), 404

    try:
        mimetype, _ = guess_type(file_path)
        return send_file(file_path, mimetype=mimetype or 'application/octet-stream')
    except Exception as e:
        return jsonify({'error': f'Failed to fetch image: {str(e)}'}), 500

@app.route('/api/image/<filename>', methods=['GET'])
def get_image_top(filename):
    file_path = os.path.join(BASE_PATH, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'Image not found'}), 404
    try:
        mimetype, _ = guess_type(file_path)
        return send_file(file_path, mimetype=mimetype or 'application/octet-stream')
    except Exception as e:
        return jsonify({'error': f'Failed to fetch image: {str(e)}'}), 500

# Download Endpoint (Require JWT authentication)
@app.route('/api/download/<path:foldername>/<filename>', methods=['GET'])
@jwt_required()
def download_image(foldername, filename):
    try:
        parts = normalize_parts_from_path(foldername)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    file_path = os.path.join(folder_path, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'Image not found'}), 404

    try:
        return send_file(file_path, as_attachment=True, conditional=True)
    except Exception as e:
        return jsonify({'error': f'Failed to download image: {str(e)}'}), 500

@app.route('/api/download/<filename>', methods=['GET'])
@jwt_required()
def download_image_top(filename):
    file_path = os.path.join(BASE_PATH, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'Image not found'}), 404
    try:
        return send_file(file_path, as_attachment=True, conditional=True)
    except Exception as e:
        return jsonify({'error': f'Failed to download image: {str(e)}'}), 500

# Chunked upload route for large video and image files (supports GB-sized files smoothly)
@app.route('/api/upload-chunk', methods=['POST', 'OPTIONS'])
@photographer_or_admin_required
def upload_chunk():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    file = request.files.get('file')
    filename = request.form.get('filename')
    chunk_index = int(request.form.get('chunkIndex', 0))
    total_chunks = int(request.form.get('totalChunks', 1))
    foldername = request.form.get('folderId', '')

    if not file or not filename or not foldername:
        return jsonify({'error': 'Missing required fields'}), 400

    filename = secure_filename(filename)
    if not allowed_file(filename):
        return jsonify({'error': 'File type not allowed'}), 400

    try:
        parts = normalize_parts_from_path(foldername)
        target_folder = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    # Create safe temp chunk directory
    temp_dir = os.path.join(BASE_PATH, '.temp_chunks', filename)
    os.makedirs(temp_dir, exist_ok=True)

    # Save current slice
    chunk_path = os.path.join(temp_dir, f"{filename}.part{chunk_index}")
    file.save(chunk_path)

    # Check if all chunks have arrived
    all_chunks_exist = True
    for i in range(total_chunks):
        part_path = os.path.join(temp_dir, f"{filename}.part{i}")
        if not os.path.exists(part_path):
            all_chunks_exist = False
            break

    if all_chunks_exist:
        final_file_path = os.path.join(target_folder, filename)
        try:
            with open(final_file_path, 'wb') as merged_file:
                for i in range(total_chunks):
                    part_path = os.path.join(temp_dir, f"{filename}.part{i}")
                    with open(part_path, 'rb') as part_file:
                        merged_file.write(part_file.read())
            
            # Cleanup temp directory
            shutil.rmtree(temp_dir)
            log_activity("upload", details=f"Folder: {foldername}, File: {filename} (Merged {total_chunks} chunks)")
            return jsonify({'message': 'File uploaded and merged successfully', 'completed': True}), 201
        except Exception as e:
            if os.path.exists(final_file_path):
                os.remove(final_file_path)
            return jsonify({'error': f'Failed to merge chunks: {str(e)}'}), 500
    
    return jsonify({'message': f'Chunk {chunk_index + 1}/{total_chunks} uploaded successfully', 'completed': False}), 200

# Photographer upload route
@app.route('/api/upload/<path:foldername>', methods=['POST', 'OPTIONS'])
@photographer_or_admin_required
def upload_image(foldername):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    try:
        parts = normalize_parts_from_path(foldername)
        target_folder = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    if not os.path.exists(target_folder) or not os.path.isdir(target_folder):
        return jsonify({'error': 'Target folder does not exist'}), 404

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    files = request.files.getlist('file')
    saved_files = []
    skipped_files = []

    try:
        for file in files:
            if not file or file.filename == '':
                continue
            filename = secure_filename(file.filename)
            if not allowed_file(filename):
                skipped_files.append(filename)
                continue
            file_path = os.path.join(target_folder, filename)
            file.save(file_path)
            saved_files.append(filename)

        if not saved_files:
            return jsonify({'error': 'No valid image files uploaded', 'skipped': skipped_files}), 400

        log_activity("upload", details=f"Folder: {foldername}, Files: {', '.join(saved_files)}")
        return jsonify({'message': 'Files uploaded successfully', 'files': saved_files, 'skipped': skipped_files}), 201
    except Exception as e:
        return jsonify({'error': f'Failed to upload files: {str(e)}'}), 500

# Create subfolders
@app.route('/api/create-folder/<path:foldername>', methods=['POST', 'OPTIONS'])
@photographer_or_admin_required
def create_folder(foldername):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    try:
        parts = normalize_parts_from_path(foldername)
        new_folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    try:
        os.makedirs(new_folder_path, exist_ok=False)
        log_activity("create_folder", details=foldername)
        return jsonify({'message': f"Folder '{foldername}' created successfully"}), 201
    except FileExistsError:
        return jsonify({'error': 'Folder already exists'}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to create folder: {str(e)}'}), 500

# Delete images
@app.route('/api/delete/<path:foldername>/<filename>', methods=['DELETE', 'OPTIONS'])
@photographer_or_admin_required
def delete_image(foldername, filename):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    try:
        parts = normalize_parts_from_path(foldername)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    file_path = os.path.join(folder_path, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'Image not found'}), 404

    try:
        os.remove(file_path)
        log_activity("delete_image", details=f"Folder: {foldername}, File: {filename}")
        return jsonify({'message': 'Deleted'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to delete image: {str(e)}'}), 500

@app.route('/api/delete/<filename>', methods=['DELETE', 'OPTIONS'])
@photographer_or_admin_required
def delete_image_top(filename):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    file_path = os.path.join(BASE_PATH, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'Image not found'}), 404
    try:
        os.remove(file_path)
        log_activity("delete_image", details=f"Folder: [root], File: {filename}")
        return jsonify({'message': 'Deleted'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to delete image: {str(e)}'}), 500

# Rename image/folder endpoints
@app.route('/api/rename', methods=['POST', 'OPTIONS'])
@photographer_or_admin_required
def rename_file():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    data = request.get_json(force=True, silent=True) or {}
    folder_id = data.get('folderId', '')
    old_name = data.get('oldName')
    new_name = data.get('newName')

    if not old_name or not new_name:
        return jsonify({'error': 'oldName and newName are required'}), 400

    if not allowed_file(old_name) or not allowed_file(new_name):
        return jsonify({'error': 'Unsupported file extension'}), 400

    try:
        parts = normalize_parts_from_path(folder_id)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    old_path = os.path.join(folder_path, secure_filename(old_name))
    new_path = os.path.join(folder_path, secure_filename(new_name))

    if not os.path.exists(old_path) or not os.path.isfile(old_path):
        return jsonify({'error': 'Original file not found'}), 404

    if os.path.exists(new_path):
        return jsonify({'error': 'A file with the new name already exists'}), 400

    try:
        os.rename(old_path, new_path)
        log_activity("rename_image", details=f"Folder: {folder_id}, Old: {old_name}, New: {new_name}")
        return jsonify({'message': 'Renamed'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to rename file: {str(e)}'}), 500

@app.route('/api/rename-folder/<path:foldername>', methods=['POST', 'OPTIONS'])
@photographer_or_admin_required
def rename_folder(foldername):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    data = request.get_json(force=True, silent=True) or {}
    new_name = data.get('newName')
    if not new_name or new_name.strip() == '':
        return jsonify({'error': 'newName required'}), 400

    try:
        parts = normalize_parts_from_path(foldername)
        if not parts:
            return jsonify({'error': 'Invalid folder'}), 400
        parent_parts = parts[:-1]
        old_folder_path = safe_join_base(*parts)
        new_folder_path = safe_join_base(*parent_parts, secure_filename(new_name))
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    if not os.path.exists(old_folder_path) or not os.path.isdir(old_folder_path):
        return jsonify({'error': 'Folder not found'}), 404
    if os.path.exists(new_folder_path):
        return jsonify({'error': 'Target folder name already exists'}), 400

    try:
        os.rename(old_folder_path, new_folder_path)
        log_activity("rename_folder", details=f"Old: {foldername}, NewName: {new_name}")
        return jsonify({'message': 'Folder renamed'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to rename folder: {str(e)}'}), 500

@app.route('/api/rename-image/<path:foldername>/<old_name>', methods=['POST', 'OPTIONS'])
@photographer_or_admin_required
def rename_image(foldername, old_name):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    data = request.get_json(force=True, silent=True) or {}
    new_name = data.get('newName')
    if not new_name or new_name.strip() == '':
        return jsonify({'error': 'newName required'}), 400

    if not allowed_file(old_name) or not allowed_file(new_name):
        return jsonify({'error': 'Unsupported file extension'}), 400

    try:
        parts = normalize_parts_from_path(foldername)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    old_path = os.path.join(folder_path, secure_filename(old_name))
    new_path = os.path.join(folder_path, secure_filename(new_name))

    if not os.path.exists(old_path) or not os.path.isfile(old_path):
        return jsonify({'error': 'Original file not found'}), 404
    if os.path.exists(new_path):
        return jsonify({'error': 'A file with the new name already exists'}), 400

    try:
        os.rename(old_path, new_path)
        log_activity("rename_image", details=f"Folder: {foldername}, Old: {old_name}, New: {new_name}")
        return jsonify({'message': 'Image renamed'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to rename image: {str(e)}'}), 500

# Download Selected Zip
@app.route('/api/download-zip', methods=['POST', 'OPTIONS'])
@jwt_required()
def download_zip():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    data = request.get_json(force=True, silent=True) or {}
    folder_id = data.get('folderId', '')
    filenames = data.get('filenames', [])

    if not filenames:
        return jsonify({'error': 'No filenames provided'}), 400

    try:
        parts = normalize_parts_from_path(folder_id)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
        return jsonify({'error': 'Folder not found'}), 404

    import io
    import zipfile

    memory_file = io.BytesIO()
    try:
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for filename in filenames:
                safe_name = secure_filename(filename)
                file_path = os.path.join(folder_path, safe_name)
                if os.path.exists(file_path) and os.path.isfile(file_path):
                    zip_file.write(file_path, safe_name)

        memory_file.seek(0)

        folder_name = parts[-1] if parts else "download"
        download_name = f"{secure_filename(folder_name)}.zip"

        return send_file(
            memory_file,
            mimetype='application/zip',
            as_attachment=True,
            download_name=download_name
        )
    except Exception as e:
        return jsonify({'error': f'Failed to create zip: {str(e)}'}), 500

# Admin Portal APIs
@app.route('/api/admin/users', methods=['GET', 'OPTIONS'])
@admin_required
def admin_get_users():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    try:
        users = User.query.all()
        user_list = [{'id': u.id, 'email': u.email, 'role': u.role} for u in users]
        return jsonify(user_list), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>/role', methods=['POST', 'OPTIONS'])
@admin_required
def admin_update_user_role(user_id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    
    data = request.get_json(force=True, silent=True) or {}
    new_role = data.get('role')
    
    if new_role not in ('admin', 'photographer', 'user'):
        return jsonify({'error': 'Invalid role specified'}), 400
        
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        if user.email.lower() == ADMIN_EMAIL.lower() and new_role != 'admin':
            return jsonify({'error': 'Cannot revoke Admin status of primary admin account'}), 400
            
        old_role = user.role
        user.role = new_role
        db.session.commit()
        
        log_activity("change_user_role", details=f"Target: {user.email}, OldRole: {old_role}, NewRole: {new_role}")
        return jsonify({'message': 'User role updated successfully', 'user': {'id': user.id, 'email': user.email, 'role': user.role}}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/logs', methods=['GET', 'OPTIONS'])
@admin_required
def admin_get_logs():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    try:
        logs = ActivityLog.query.order_by(ActivityLog.timestamp.desc()).all()
        log_list = []
        for l in logs:
            log_list.append({
                'id': l.id,
                'userId': l.user_id,
                'userEmail': l.user_email,
                'action': l.action,
                'details': l.details,
                'timestamp': l.timestamp.strftime('%Y-%m-%d %H:%M:%S')
            })
        return jsonify(log_list), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Club Member Routes ---

@app.route('/Members/<path:filename>')
def serve_member_photo(filename):
    return send_from_directory(os.path.join(BASE_PATH, 'Members'), filename)

@app.route('/api/members', methods=['GET'])
def get_members():
    try:
        members = ClubMember.query.order_by(ClubMember.display_order.asc()).all()
        result = []
        for m in members:
            result.append({
                'id': m.id,
                'name': m.name,
                'photo': m.photo,
                'quote': m.quote,
                'instagram': m.instagram,
                'instaLink': m.insta_link,
                'role_type': m.role_type,
                'display_order': m.display_order
            })
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/members/upload-avatar', methods=['POST', 'OPTIONS'])
@admin_required
def upload_member_avatar():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file uploaded'}), 400
    try:
        filename = secure_filename(file.filename)
        filename = f"{int(datetime.utcnow().timestamp())}_{filename}"
        members_dir = os.path.join(BASE_PATH, 'Members')
        os.makedirs(members_dir, exist_ok=True)
        file.save(os.path.join(members_dir, filename))
        return jsonify({'photoUrl': f'/Members/{filename}'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/members', methods=['POST', 'OPTIONS'])
@admin_required
def add_member():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    try:
        max_order = db.session.query(db.func.max(ClubMember.display_order)).scalar() or 0
        member = ClubMember(
            name=name,
            photo=data.get('photo', '/images/avatar_placeholder.png'),
            quote=data.get('quote', ''),
            instagram=data.get('instagram', ''),
            insta_link=data.get('instaLink', ''),
            role_type=data.get('role_type', 'poc'),
            display_order=max_order + 1
        )
        db.session.add(member)
        db.session.commit()
        log_activity("add_member", details=f"Member: {name}, Role: {member.role_type}")
        return jsonify({'message': 'Member added successfully', 'id': member.id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/members/<int:member_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
@admin_required
def manage_member(member_id):
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    member = ClubMember.query.get_or_404(member_id)
    if request.method == 'DELETE':
        try:
            name = member.name
            db.session.delete(member)
            db.session.commit()
            log_activity("delete_member", details=f"Member: {name}")
            return jsonify({'message': 'Member deleted successfully'}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    # PUT
    data = request.get_json(silent=True) or {}
    try:
        member.name = data.get('name', member.name)
        member.photo = data.get('photo', member.photo)
        member.quote = data.get('quote', member.quote)
        member.instagram = data.get('instagram', member.instagram)
        member.insta_link = data.get('instaLink', member.insta_link)
        member.role_type = data.get('role_type', member.role_type)
        if 'display_order' in data:
            member.display_order = data['display_order']
        db.session.commit()
        log_activity("edit_member", details=f"Member: {member.name}")
        return jsonify({'message': 'Member updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Admin Media Placement Endpoint ---

@app.route('/api/admin/assign-media', methods=['POST', 'OPTIONS'])
@admin_required
def assign_media():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
    data = request.get_json(silent=True) or {}
    filepath = data.get('filepath')
    action = data.get('action') # "set_hero" | "remove_hero" | "set_featured" | "remove_featured"
    category = data.get('category', '').strip()

    if not filepath or not action:
        return jsonify({'error': 'Filepath and action are required'}), 400

    source_path = os.path.abspath(os.path.join(BASE_PATH, filepath))
    if not os.path.exists(source_path) or not os.path.isfile(source_path):
        return jsonify({'error': f'Source file not found at {filepath}'}), 404

    filename = os.path.basename(source_path)

    try:
        if action == "set_hero":
            hero_dir = os.path.join(BASE_PATH, 'Hero')
            os.makedirs(hero_dir, exist_ok=True)
            dest_path = os.path.join(hero_dir, filename)
            shutil.copy2(source_path, dest_path)
            log_activity("assign_media", details=f"Hero set: {filename}")
            return jsonify({'message': f'Photo set as Hero background successfully'}), 200

        elif action == "remove_hero":
            hero_path = os.path.join(BASE_PATH, 'Hero', filename)
            if os.path.exists(hero_path):
                os.remove(hero_path)
                log_activity("assign_media", details=f"Hero removed: {filename}")
                return jsonify({'message': 'Photo removed from Hero slideshow'}), 200
            return jsonify({'error': 'File not found in Hero folder'}), 404

        elif action == "set_featured":
            if not category:
                return jsonify({'error': 'Category is required for featured photos'}), 400
            featured_dir = os.path.join(BASE_PATH, 'Feature', secure_filename(category))
            os.makedirs(featured_dir, exist_ok=True)
            dest_path = os.path.join(featured_dir, filename)
            shutil.copy2(source_path, dest_path)
            log_activity("assign_media", details=f"Featured set: {filename} in {category}")
            return jsonify({'message': f'Photo featured under {category} successfully'}), 200

        elif action == "remove_featured":
            if not category:
                return jsonify({'error': 'Category is required to remove featured photo'}), 400
            featured_path = os.path.join(BASE_PATH, 'Feature', secure_filename(category), filename)
            if os.path.exists(featured_path):
                os.remove(featured_path)
                log_activity("assign_media", details=f"Featured removed: {filename} from {category}")
                return jsonify({'message': f'Photo removed from Featured: {category}'}), 200
            return jsonify({'error': f'File not found in category: {category}'}), 404

        else:
            return jsonify({'error': f'Invalid action: {action}'}), 400

    except Exception as e:
        return jsonify({'error': f'Failed to perform media assignment: {str(e)}'}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', '8087'))
    debug = os.getenv('FLASK_DEBUG', 'true').lower() in ('1', 'true', 'yes')
    app.run(debug=debug, host='0.0.0.0', port=port)
