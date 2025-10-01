# team_routes.py
from flask import Blueprint, request, jsonify, current_app
import jwt
import datetime
from bson import ObjectId
from datetime import datetime
import re

# Blueprint instance
team_bp = Blueprint("team", __name__)

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

# Helper function to validate ObjectId
def is_valid_objectid(objectid_str):
    """Check if a string is a valid MongoDB ObjectId"""
    if not objectid_str:
        return False
    if not isinstance(objectid_str, str):
        return False
    if len(objectid_str) != 24:
        return False
    return re.match(r'^[a-f0-9]{24}$', objectid_str) is not None

# ---------------- TEAM MANAGEMENT ----------------
@team_bp.route("/team/members", methods=["GET"])
def get_team_members():
    users_col = current_app.config["USERS_COLLECTION"]
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    tasks_col = current_app.config["TASKS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get the current user's role to determine which team members to show
        current_user = users_col.find_one({"email": decoded["email"]})
        if not current_user:
            return jsonify({"error": "User not found"}), 404
        
        # Build query based on user role
        query = {}
        if current_user["role"] == "Supervisor":
            # Supervisors can see all workers
            query = {"role": "Worker"}
        elif current_user["role"] == "Manager":
            # Managers can see all workers and supervisors
            query = {"role": {"$in": ["Worker", "Supervisor"]}}
        else:
            # Workers can only see themselves
            query = {"email": decoded["email"]}
        
        # Get team members
        team_members = list(users_col.find(query, {
            "password": 0,  # Exclude password
            "created_at": 0  # Exclude created_at if not needed
        }))
        
        # Get today's date for attendance and stats
        today = datetime.now().date().isoformat()
        
        # Enrich team members with additional data
        enriched_members = []
        for member in team_members:
            # Get today's attendance
            attendance = attendance_col.find_one({
                "workerId": str(member["_id"]),
                "date": today
            })
            
            # Get task statistics
            assigned_tasks = tasks_col.count_documents({
                "assignedTo": str(member["_id"]),
                "status": {"$in": ["pending", "in-progress"]}
            })
            
            completed_tasks = tasks_col.count_documents({
                "assignedTo": str(member["_id"]),
                "status": "completed"
            })
            
            # Get safety violations count
            safety_col = current_app.config["SAFETY_COLLECTION"]
            safety_violations = safety_col.count_documents({
                "workerId": str(member["_id"]),
                "resolved": False
            })
            
            enriched_member = {
                "_id": str(member["_id"]),
                "name": member["name"],
                "email": member["email"],
                "role": member["role"],
                "phone": member.get("phone", ""),
                "position": member.get("position", member["role"]),
                "todayAttendance": attendance.get("status", "absent") if attendance else "absent",
                "checkInTime": attendance.get("checkIn", "") if attendance else "",
                "checkOutTime": attendance.get("checkOut", "") if attendance else "",
                "assignedTasks": assigned_tasks,
                "completedTasks": completed_tasks,
                "safetyViolations": safety_violations,
                "status": member.get("status", "active"),
                "lastActive": member.get("lastActive", "")
            }
            
            enriched_members.append(enriched_member)
        
        return jsonify(enriched_members), 200
        
    except Exception as e:
        current_app.logger.error(f"Team members fetch error: {str(e)}")
        return jsonify({"error": "Failed to fetch team members"}), 500

@team_bp.route("/team/members/<member_id>", methods=["GET"])
def get_team_member(member_id):
    users_col = current_app.config["USERS_COLLECTION"]
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    tasks_col = current_app.config["TASKS_COLLECTION"]
    safety_col = current_app.config["SAFETY_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Validate member ID
        if not ObjectId.is_valid(member_id):
            return jsonify({"error": "Invalid member ID"}), 400
        
        # Get team member
        member = users_col.find_one({"_id": ObjectId(member_id)}, {"password": 0})
        if not member:
            return jsonify({"error": "Team member not found"}), 404
        
        # Get attendance history (last 7 days)
        seven_days_ago = (datetime.now().date() - datetime.timedelta(days=7)).isoformat()
        attendance_history = list(attendance_col.find({
            "workerId": member_id,
            "date": {"$gte": seven_days_ago}
        }).sort("date", -1))
        
        # Get current tasks
        current_tasks = list(tasks_col.find({
            "assignedTo": member_id,
            "status": {"$in": ["pending", "in-progress"]}
        }).sort("due_date", 1))
        
        # Get completed tasks (last 10)
        completed_tasks = list(tasks_col.find({
            "assignedTo": member_id,
            "status": "completed"
        }).sort("completed_at", -1).limit(10))
        
        # Get safety violations
        safety_violations = list(safety_col.find({
            "workerId": member_id
        }).sort("timestamp", -1).limit(5))
        
        # Format response
        member_details = {
            "_id": str(member["_id"]),
            "name": member["name"],
            "email": member["email"],
            "role": member["role"],
            "phone": member.get("phone", ""),
            "position": member.get("position", member["role"]),
            "status": member.get("status", "active"),
            "joinedDate": member.get("created_at", "").isoformat() if member.get("created_at") else "",
            "lastActive": member.get("lastActive", ""),
            "attendanceHistory": [{
                "date": att["date"],
                "status": att["status"],
                "checkIn": att.get("checkIn", ""),
                "checkOut": att.get("checkOut", "")
            } for att in attendance_history],
            "currentTasks": [{
                "_id": str(task["_id"]),
                "title": task["title"],
                "description": task.get("description", ""),
                "dueDate": task.get("due_date", ""),
                "priority": task.get("priority", "medium"),
                "status": task.get("status", "pending")
            } for task in current_tasks],
            "recentCompletedTasks": [{
                "_id": str(task["_id"]),
                "title": task["title"],
                "completedAt": task.get("completed_at", "")
            } for task in completed_tasks],
            "safetyViolations": [{
                "_id": str(violation["_id"]),
                "type": ", ".join(violation.get("violations", [])),
                "date": violation.get("timestamp", ""),
                "status": violation.get("status", "pending"),
                "resolved": violation.get("resolved", False)
            } for violation in safety_violations],
            "stats": {
                "totalTasks": len(current_tasks) + len(completed_tasks),
                "pendingTasks": len(current_tasks),
                "completedTasks": len(completed_tasks),
                "attendanceRate": len([att for att in attendance_history if att.get("status") == "present"]) / max(len(attendance_history), 1) * 100,
                "safetyViolationsCount": len(safety_violations)
            }
        }
        
        return jsonify(member_details), 200
        
    except Exception as e:
        current_app.logger.error(f"Team member fetch error: {str(e)}")
        return jsonify({"error": "Failed to fetch team member details"}), 500

@team_bp.route("/team/members/<member_id>", methods=["PUT"])
def update_team_member(member_id):
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Validate member ID
        if not ObjectId.is_valid(member_id):
            return jsonify({"error": "Invalid member ID"}), 400
        
        data = request.json
        
        # Check if user exists
        member = users_col.find_one({"_id": ObjectId(member_id)})
        if not member:
            return jsonify({"error": "Team member not found"}), 404
        
        # Prepare update data (only allow certain fields to be updated)
        allowed_fields = ["phone", "position", "status"]
        update_data = {}
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        # Update the team member
        result = users_col.update_one(
            {"_id": ObjectId(member_id)}, 
            {"$set": update_data}
        )
        
        if result.modified_count:
            # Get updated member
            updated_member = users_col.find_one({"_id": ObjectId(member_id)}, {"password": 0})
            return jsonify({
                "message": "Team member updated successfully",
                "member": {
                    "_id": str(updated_member["_id"]),
                    "name": updated_member["name"],
                    "email": updated_member["email"],
                    "role": updated_member["role"],
                    "phone": updated_member.get("phone", ""),
                    "position": updated_member.get("position", updated_member["role"]),
                    "status": updated_member.get("status", "active")
                }
            }), 200
        else:
            return jsonify({"error": "Team member not found or no changes made"}), 404
            
    except Exception as e:
        current_app.logger.error(f"Team member update error: {str(e)}")
        return jsonify({"error": "Failed to update team member"}), 500

@team_bp.route("/team/stats", methods=["GET"])
def team_stats():
    users_col = current_app.config["USERS_COLLECTION"]
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    tasks_col = current_app.config["TASKS_COLLECTION"]
    safety_col = current_app.config["SAFETY_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get current user to determine scope
        current_user = users_col.find_one({"email": decoded["email"]})
        if not current_user:
            return jsonify({"error": "User not found"}), 404
        
        # Build query based on user role
        query = {}
        if current_user["role"] == "Supervisor":
            query = {"role": "Worker"}
        elif current_user["role"] == "Manager":
            query = {"role": {"$in": ["Worker", "Supervisor"]}}
        else:
            query = {"email": decoded["email"]}
        
        # Get team members count
        total_members = users_col.count_documents(query)
        active_members = users_col.count_documents({**query, "status": "active"})
        
        # Get today's attendance
        today = datetime.now().date().isoformat()
        present_today = attendance_col.count_documents({
            "date": today,
            "status": "present"
        })
        
        # Get task statistics
        total_tasks = tasks_col.count_documents({})
        completed_tasks = tasks_col.count_documents({"status": "completed"})
        overdue_tasks = tasks_col.count_documents({
            "due_date": {"$lt": today},
            "status": {"$in": ["pending", "in-progress"]}
        })
        
        # Get safety statistics
        safety_violations = safety_col.count_documents({"resolved": False})
        
        return jsonify({
            "totalMembers": total_members,
            "activeMembers": active_members,
            "presentToday": present_today,
            "totalTasks": total_tasks,
            "completedTasks": completed_tasks,
            "overdueTasks": overdue_tasks,
            "safetyViolations": safety_violations,
            "completionRate": (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0,
            "attendanceRate": (present_today / total_members * 100) if total_members > 0 else 0
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Team stats error: {str(e)}")
        return jsonify({"error": "Failed to fetch team statistics"}), 500

@team_bp.route("/team/attendance", methods=["GET"])
def team_attendance():
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get date range from query parameters (default to last 7 days)
        start_date = request.args.get('start_date', 
            (datetime.now().date() - datetime.timedelta(days=7)).isoformat())
        end_date = request.args.get('end_date', datetime.now().date().isoformat())
        
        # Get attendance data
        attendance_data = list(attendance_col.find({
            "date": {"$gte": start_date, "$lte": end_date}
        }).sort("date", -1))
        
        # Group by date and calculate stats
        attendance_by_date = {}
        for record in attendance_data:
            date = record["date"]
            if date not in attendance_by_date:
                attendance_by_date[date] = {
                    "present": 0,
                    "absent": 0,
                    "late": 0,
                    "total": 0
                }
            
            attendance_by_date[date]["total"] += 1
            if record["status"] == "present":
                attendance_by_date[date]["present"] += 1
            elif record["status"] == "absent":
                attendance_by_date[date]["absent"] += 1
            elif record["status"] == "late":
                attendance_by_date[date]["late"] += 1
        
        # Convert to array format for frontend
        attendance_stats = []
        for date, stats in attendance_by_date.items():
            attendance_stats.append({
                "date": date,
                "present": stats["present"],
                "absent": stats["absent"],
                "late": stats["late"],
                "total": stats["total"],
                "attendanceRate": (stats["present"] / stats["total"] * 100) if stats["total"] > 0 else 0
            })
        
        # Sort by date
        attendance_stats.sort(key=lambda x: x["date"], reverse=True)
        
        return jsonify(attendance_stats), 200
        
    except Exception as e:
        current_app.logger.error(f"Team attendance error: {str(e)}")
        return jsonify({"error": "Failed to fetch attendance data"}), 500