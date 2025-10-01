# auth_routes.py
from flask import Blueprint, request, jsonify, current_app
import jwt
import datetime
from bson import ObjectId

# Blueprint instance
auth_bp = Blueprint("auth", __name__)

# ---------------- LOGIN ----------------
@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        users = current_app.config["USERS_COLLECTION"]
        data = request.json

        # Validate request data
        if not data or not data.get("email") or not data.get("password"):
            return jsonify({"error": "Email and password are required"}), 400

        # Find user by email
        user = users.find_one({"email": data.get("email")})
        
        if not user:
            return jsonify({"error": "Invalid email or password"}), 401
        
        # Plain text password check (without hashing)
        if user.get("password") == data.get("password"):
            # Generate JWT token
            token = jwt.encode({
                "email": user["email"],
                "role": user["role"],
                "name": user["name"],
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=12)
            }, current_app.config["SECRET_KEY"], algorithm="HS256")

            return jsonify({
                "token": token, 
                "role": user["role"],
                "user": {
                    "name": user["name"],
                    "email": user["email"],
                    "role": user["role"]
                }
            }), 200

        return jsonify({"error": "Invalid email or password"}), 401

    except Exception as e:
        current_app.logger.error(f"Login error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500