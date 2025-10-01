# user_routes.py or add to existing auth_routes.py
from flask import Blueprint, request, jsonify, current_app
import jwt
from bson import ObjectId

# Blueprint instance
user_bp = Blueprint("users", __name__)

# Helper function to verify JWT token
def verify_token():
    token = request.headers.get("Authorization", None)
    if not token:
        return None, jsonify({"error": "Missing token"}), 401

    try:
        if token.startswith("Bearer "):
            token = token[7:]
        decoded = jwt.decode(token, str(current_app.config["SECRET_KEY"]), algorithms=["HS256"])
        return decoded, None, None
    except jwt.ExpiredSignatureError:
        return None, jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return None, jsonify({"error": "Invalid token"}), 401

# ---------------- GET ALL USERS ----------------
@user_bp.route("/users", methods=["GET"])
def get_users():
    try:
        users_col = current_app.config["USERS_COLLECTION"]
        
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get all users (you might want to add filters based on role)
        users = list(users_col.find({}, {"password": 0}))  # Exclude passwords
        
        # Convert ObjectId to string for JSON serialization
        users_list = []
        for user in users:
            user["_id"] = str(user["_id"])
            users_list.append(user)
        
        return jsonify(users_list), 200
        
    except Exception as e:
        current_app.logger.error(f"Get users error: {str(e)}")
        return jsonify({"error": "Failed to fetch users"}), 500

# ---------------- GET USERS BY ROLE ----------------
@user_bp.route("/users/role/<role>", methods=["GET"])
def get_users_by_role(role):
    try:
        users_col = current_app.config["USERS_COLLECTION"]
        
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Validate role
        valid_roles = ["Worker", "Supervisor", "Manager"]
        if role not in valid_roles:
            return jsonify({"error": "Invalid role"}), 400
        
        # Get users by role
        users = list(users_col.find({"role": role}, {"password": 0}))  # Exclude passwords
        
        # Convert ObjectId to string for JSON serialization
        users_list = []
        for user in users:
            user["_id"] = str(user["_id"])
            users_list.append(user)
        
        return jsonify(users_list), 200
        
    except Exception as e:
        current_app.logger.error(f"Get users by role error: {str(e)}")
        return jsonify({"error": "Failed to fetch users"}), 500

# ---------------- GET USER BY ID ----------------
@user_bp.route("/users/<user_id>", methods=["GET"])
def get_user(user_id):
    try:
        users_col = current_app.config["USERS_COLLECTION"]
        
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Validate ObjectId
        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400
        
        # Get user by ID
        user = users_col.find_one({"_id": ObjectId(user_id)}, {"password": 0})
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        user["_id"] = str(user["_id"])
        
        return jsonify(user), 200
        
    except Exception as e:
        current_app.logger.error(f"Get user error: {str(e)}")
        return jsonify({"error": "Failed to fetch user"}), 500

# ---------------- UPDATE USER ----------------
@user_bp.route("/users/<user_id>", methods=["PUT"])
def update_user(user_id):
    try:
        users_col = current_app.config["USERS_COLLECTION"]
        
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Validate ObjectId
        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400
        
        data = request.json
        
        # Check if user exists
        user = users_col.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Prepare update data (exclude sensitive fields)
        update_data = {}
        allowed_fields = ["name", "email", "role"]
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        # Validate role if provided
        if "role" in update_data:
            valid_roles = ["Worker", "Supervisor", "Manager"]
            if update_data["role"] not in valid_roles:
                return jsonify({"error": "Invalid role"}), 400
        
        # Update the user
        result = users_col.update_one(
            {"_id": ObjectId(user_id)}, 
            {"$set": update_data}
        )
        
        if result.modified_count:
            # Return updated user (without password)
            updated_user = users_col.find_one({"_id": ObjectId(user_id)}, {"password": 0})
            updated_user["_id"] = str(updated_user["_id"])
            
            return jsonify({
                "message": "User updated successfully",
                "user": updated_user
            }), 200
        else:
            return jsonify({"error": "User not found or no changes made"}), 404
        
    except Exception as e:
        current_app.logger.error(f"Update user error: {str(e)}")
        return jsonify({"error": "Failed to update user"}), 500

# ---------------- DELETE USER ----------------
@user_bp.route("/users/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    try:
        users_col = current_app.config["USERS_COLLECTION"]
        
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Validate ObjectId
        if not ObjectId.is_valid(user_id):
            return jsonify({"error": "Invalid user ID"}), 400
        
        # Check if user exists
        user = users_col.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Prevent deletion of own account
        if decoded["email"] == user["email"]:
            return jsonify({"error": "Cannot delete your own account"}), 400
        
        # Delete the user
        result = users_col.delete_one({"_id": ObjectId(user_id)})
        
        if result.deleted_count:
            return jsonify({"message": "User deleted successfully"}), 200
        else:
            return jsonify({"error": "User not found"}), 404
        
    except Exception as e:
        current_app.logger.error(f"Delete user error: {str(e)}")
        return jsonify({"error": "Failed to delete user"}), 500