# auth.py — AUTH ONLY (register/login/JWT verify). No gallery/file routes.

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
import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# --- CONFIGURATION ---
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///site.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.getenv(
    "JWT_SECRET_KEY", "your-super-secret-key-that-is-very-long"
)
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)

# Admin email
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "dharani080905@gmail.com")

# --- INITIALIZATION ---
CORS(
    app,
    supports_credentials=True,
    resources={r"/*": {"origins": [
        "http://localhost:3000",   # React default
        "http://localhost:5173",   # Vite default
        "http://localhost:5174",   # Your new frontend port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://150.230.138.173:8087",  # deployed frontend
    ]}},
)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)


# --- DATABASE MODEL ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)


# --- AUTH ROUTES ---
@app.route("/register", methods=["POST", "OPTIONS"])
@cross_origin()
def register():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200  # Preflight response

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = data.get("password")

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"success": False, "message": "Email already registered"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
    user = User(email=email, password=hashed_password)
    db.session.add(user)
    db.session.commit()

    return jsonify({"success": True, "message": "Registration successful."}), 201


@app.route("/login", methods=["POST", "OPTIONS"])
@cross_origin()
def login():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200  # Preflight response

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = data.get("password")

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password, password):
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    # Admin check
    is_admin = (user.email == ADMIN_EMAIL)

    identity = {"id": user.id, "email": user.email, "is_admin": is_admin}
    access_token = create_access_token(identity=identity)

    return jsonify({"success": True, "token": access_token, "user": identity}), 200


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


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, host="0.0.0.0", port=5000)
