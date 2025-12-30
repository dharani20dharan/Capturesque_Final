from flask import Flask, request, jsonify
from flask_bcrypt import Bcrypt
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
)
from flask_cors import CORS, cross_origin
from functools import wraps
import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("JWT_SECRET_KEY FROM ENV:", os.getenv("JWT_SECRET_KEY"))


app = Flask(__name__)

# --- CONFIGURATION ---
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///site.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
JWT_SECRET = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET_KEY is not set in environment")

app.config["JWT_SECRET_KEY"] = JWT_SECRET

# Token lifetime can be controlled via env var (default 1 hour)
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=int(os.getenv("JWT_EXPIRE_HOURS", "1")))

# Admin email (single admin for simplicity) - set via .env
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "dharani080905@gmail.com")

# --- CORS ---
CORS(
    app,
    supports_credentials=True,
    resources={r"/*": {"origins": [
        "http://localhost:3000",   # React default
        "http://localhost:5173",   # Vite default
        "http://localhost:5174",   # Other local dev port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://150.230.138.173:8087",  # deployed frontend
    ]}},
)

# --- INITIALIZATION ---
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# --- DATABASE MODEL ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)

    def __repr__(self):
        return f"<User {self.email}>"


# ------------------
# Helpers
# ------------------

def make_identity(user):
    """Return the identity payload stored in the JWT and returned to clients.
    Normalizes to include both `is_admin` (bool) and `role` ('admin'|'user') for client compatibility.
    """
    is_admin = (user.email.lower() == ADMIN_EMAIL.lower())
    role = "admin" if is_admin else "user"
    return {"id": user.id, "email": user.email, "is_admin": is_admin, "role": role}


def create_token_for_user(user):
    identity = make_identity(user)
    access_token = create_access_token(identity=identity)
    return access_token, identity


def admin_required(fn):
    """Decorator to protect admin-only endpoints in other blueprints/files.
    Example usage:
        @app.route('/api/admin-only')
        @admin_required
        def secret():
            return jsonify({'ok': True})
    """
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        identity = get_jwt_identity() or {}
        if not (identity.get("is_admin") or identity.get("role") == "admin"):
            return jsonify({"success": False, "message": "Admin access required"}), 403
        return fn(*args, **kwargs)

    return wrapper


# ------------------
# JWT error handlers
# ------------------
@jwt.unauthorized_loader
def missing_token_callback(callback):
    return jsonify({"valid": False, "message": "Missing or malformed Authorization header"}), 401


@jwt.invalid_token_loader
def invalid_token_callback(callback):
    return jsonify({"valid": False, "message": "Invalid token"}), 422


@jwt.expired_token_loader
def expired_token_callback(header, payload):
    return jsonify({"valid": False, "message": "Token has expired"}), 401


@jwt.revoked_token_loader
def revoked_token_callback(callback):
    return jsonify({"valid": False, "message": "Token has been revoked"}), 401


# ------------------
# AUTH ROUTES
# ------------------
@app.route("/register", methods=["POST", "OPTIONS"])
@cross_origin()
def register():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200  # Preflight response

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"success": False, "message": "Email already registered"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
    user = User(email=email, password=hashed_password)
    db.session.add(user)
    db.session.commit()

    # Optionally auto-login after register by returning a token (helps single-step onboarding)
    try:
        token, identity = create_token_for_user(user)
        return (
            jsonify({"success": True, "message": "Registration successful.", "token": token, "access_token": token, "accessToken": token, "user": identity}),
            201,
        )
    except Exception:
        # If token generation fails for some reason, still return success for registration
        return jsonify({"success": True, "message": "Registration successful. Please log in."}), 201


@app.route("/login", methods=["POST", "OPTIONS"])
@cross_origin()
def login():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200  # Preflight response

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password, password):
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    # Build identity and token
    token, identity = create_token_for_user(user)

    # Return a compact, frontend-friendly shape. We include multiple token keys for compatibility.
    return (
        jsonify({"success": True, "token": token, "access_token": token, "accessToken": token, "user": identity}),
        200,
    )


# --- TOKEN VERIFICATION ---
@app.route("/auth/verify", methods=["GET"])
@jwt_required()
def verify_token():
    identity = get_jwt_identity() or {}
    return jsonify({"valid": True, "user": identity}), 200


# --- HEALTH CHECK ---
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


# --- SIMPLE HELPERS FOR OTHER MODULES ---
# These helpers make it easy for other blueprints to check the current user.
def get_current_user_from_jwt():
    """Return the JWT identity dict (or {})."""
    return get_jwt_identity() or {}


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
