# manager.py
from flask import Blueprint, request, jsonify, current_app
import jwt
import datetime
from bson import ObjectId
from datetime import datetime, date

mang_bp = Blueprint("mang", __name__)

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

# ---------------- REGISTER ----------------
@mang_bp.route("/register", methods=["POST"])
def register():
    users = current_app.config["USERS_COLLECTION"]
    data = request.json

    if users.find_one({"email": data.get("email")}):
        return jsonify({"error": "User already exists"}), 400

    user = {
        "name": data.get("name"),
        "email": data.get("email"),
        "password": data.get("password"),  # plain-text for testing
        "role": data.get("role")  # Worker / Supervisor / Manager
    }

    users.insert_one(user)
    return jsonify({"message": "User registered successfully"}), 201

# ---------------- PROFILE ----------------
@mang_bp.route("/profile", methods=["GET"])
def profile():
    decoded, error_response, status_code = verify_token()
    if error_response:
        return error_response, status_code

    users = current_app.config["USERS_COLLECTION"]
    user = users.find_one({"email": decoded["email"]})
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    return jsonify({
        "name": user["name"], 
        "email": user["email"], 
        "role": user["role"]
    }), 200

# ---------------- DASHBOARD STATS ----------------
@mang_bp.route("/dashboard/stats", methods=["GET"])
def get_dashboard_stats():
    decoded, error_response, status_code = verify_token()
    if error_response:
        return error_response, status_code
    
    # Get today's date for filtering
    today = date.today().isoformat()
    
    # Count pending tasks
    tasks_col = current_app.config["TASKS_COLLECTION"]
    pending_tasks = tasks_col.count_documents({"status": {"$in": ["pending", "in-progress"]}})
    
    # Count today's attendance
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    today_attendance = attendance_col.count_documents({"date": today})
    
    # Count unresolved safety issues
    safety_col = current_app.config["SAFETY_COLLECTION"]
    safety_issues = safety_col.count_documents({"resolved": False})
    
    # Count active emergencies
    emergency_col = current_app.config["EMERGENCY_COLLECTION"]
    active_emergencies = emergency_col.count_documents({"resolved": False})
    
    return jsonify({
        "pendingTasks": pending_tasks,
        "todayAttendance": today_attendance,
        "safetyIssues": safety_issues,
        "activeEmergencies": active_emergencies
    }), 200

# ---------------- ATTENDANCE ----------------
from bson.objectid import ObjectId
from flask import Blueprint, jsonify, current_app, request
from datetime import datetime

@mang_bp.route("/attendance", methods=["GET", "POST"])
def attendance():
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]

    if request.method == "GET":
        records = list(attendance_col.find({}))
        attendance_list = []

        for rec in records:
            worker_id = rec.get("workerId")  # Use .get() to avoid KeyError
            if not worker_id:
                # Skip record if workerId is missing
                continue

            worker = users_col.find_one({"_id": ObjectId(worker_id)})
            attendance_list.append({
                "workerId": worker_id,
                "name": worker["name"] if worker else "Unknown",
                "date": rec.get("date"),
                "status": rec.get("status"),
                "checkIn": rec.get("checkIn"),
                "checkOut": rec.get("checkOut"),
                "timestamp": rec.get("timestamp")
            })

        return jsonify(attendance_list), 200

    elif request.method == "POST":
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code

        data = request.json
        if "workerId" not in data:
            return jsonify({"error": "workerId is required"}), 400

        data["timestamp"] = datetime.now().isoformat()
        result = attendance_col.insert_one(data)
        return jsonify({"message": "Attendance recorded successfully", "id": str(result.inserted_id)}), 201

# ---------------- TASKS ----------------
@mang_bp.route("/tasks", methods=["GET", "POST"])
def tasks():
    tasks_col = current_app.config["TASKS_COLLECTION"]
    
    if request.method == "GET":
        records = list(tasks_col.find({}, {"_id": 0}))
        return jsonify(records), 200
    
    elif request.method == "POST":
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
            
        data = request.json
        # Add creation timestamp to the task
        data["created_at"] = datetime.now().isoformat()
        data["status"] = data.get("status", "pending")
        
        # Insert the task
        result = tasks_col.insert_one(data)
        return jsonify({"message": "Task created successfully", "id": str(result.inserted_id)}), 201

@mang_bp.route("/tasks/<task_id>", methods=["PUT", "DELETE"])
def task_detail(task_id):
    tasks_col = current_app.config["TASKS_COLLECTION"]
    
    decoded, error_response, status_code = verify_token()
    if error_response:
        return error_response, status_code
    
    if request.method == "PUT":
        data = request.json
        # Update the task
        result = tasks_col.update_one(
            {"_id": ObjectId(task_id)}, 
            {"$set": data}
        )
        
        if result.modified_count:
            return jsonify({"message": "Task updated successfully"}), 200
        else:
            return jsonify({"error": "Task not found or no changes made"}), 404
    
    elif request.method == "DELETE":
        result = tasks_col.delete_one({"_id": ObjectId(task_id)})
        
        if result.deleted_count:
            return jsonify({"message": "Task deleted successfully"}), 200
        else:
            return jsonify({"error": "Task not found"}), 404

# ---------------- EMERGENCY ----------------
@mang_bp.route("/emergencies", methods=["GET", "POST"])
def emergencies():
    emergency_col = current_app.config["EMERGENCY_COLLECTION"]
    
    if request.method == "GET":
        records = list(emergency_col.find({}, {"_id": 0}))
        return jsonify(records), 200
    
    elif request.method == "POST":
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
            
        data = request.json
        # Add report timestamp and default resolved status
        data["reported_at"] = datetime.now().isoformat()
        data["resolved"] = data.get("resolved", False)
        
        # Insert the emergency report
        result = emergency_col.insert_one(data)
        return jsonify({"message": "Emergency reported successfully", "id": str(result.inserted_id)}), 201

@mang_bp.route("/emergencies/<emergency_id>", methods=["PUT"])
def emergency_detail(emergency_id):
    emergency_col = current_app.config["EMERGENCY_COLLECTION"]
    
    decoded, error_response, status_code = verify_token()
    if error_response:
        return error_response, status_code
    
    if request.method == "PUT":
        data = request.json
        # Update the emergency report
        result = emergency_col.update_one(
            {"_id": ObjectId(emergency_id)}, 
            {"$set": data}
        )
        
        if result.modified_count:
            return jsonify({"message": "Emergency report updated successfully"}), 200
        else:
            return jsonify({"error": "Emergency not found or no changes made"}), 404