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
from flask_cors import CORS
import os
from datetime import timedelta
from dotenv import load_dotenv
from functools import wraps

# Load environment variables from a .env file
load_dotenv()

app = Flask(__name__)

# --- CONFIGURATION ---
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///site.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "your-super-secret-key-that-is-very-long")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)

# The email address that will be granted admin privileges
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "dharani080905@gmail.com")

# --- INITIALIZATION ---
CORS(
    app,
    supports_credentials=True,
    origins=[
        "http://localhost:8000",
        "http://150.230.138.173:8087", # Add your frontend's origins
        "http://localhost:3000", # Common for React dev
    ],
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
@app.route("/register", methods=["POST"])
def register():
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


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = data.get("password")

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password, password):
        return jsonify({"success": False, "message": "Invalid email or password"}), 401

    # Check if the user's email matches the admin email
    is_admin = (user.email == ADMIN_EMAIL)
    
    # Create the identity payload for the JWT
    identity = {"id": user.id, "email": user.email, "is_admin": is_admin}
    access_token = create_access_token(identity=identity)

    return jsonify({"success": True, "token": access_token, "user": identity}), 200


# --- TOKEN VERIFICATION ---
@app.route("/auth/verify", methods=["GET"])
@jwt_required()
def verify_token():
    """
    Endpoint for the frontend to validate a JWT and get the user's identity.
    """
    identity = get_jwt_identity() or {}
    return jsonify({"valid": True, "user": identity}), 200


# --- HEALTH CHECK ---
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    # Use port 5000 for the auth server
    app.run(debug=True, host='0.0.0.0', port=5000)