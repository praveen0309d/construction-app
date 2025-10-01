# emergency_routes.py
from flask import Blueprint, request, jsonify, current_app
import jwt
import datetime
from bson import ObjectId
from datetime import datetime
import re

# Blueprint instance
emergency_bp = Blueprint("emergency", __name__)

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

# ---------------- EMERGENCY MANAGEMENT ----------------
@emergency_bp.route("/emergencies", methods=["GET", "POST"])
def emergencies():
    emergency_col = current_app.config["EMERGENCY_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    if request.method == "GET":
        try:
            # Get all emergency records with user details
            records = list(emergency_col.find({}).sort("timestamp", -1))
            
            # Enrich records with user information
            enriched_records = []
            for record in records:
                # Get reporter info
                reporter = None
                if is_valid_objectid(record.get("reportedBy", "")):
                    reporter = users_col.find_one({"_id": ObjectId(record["reportedBy"])})
                
                # Get worker info
                worker = None
                if is_valid_objectid(record.get("workerId", "")):
                    worker = users_col.find_one({"_id": ObjectId(record["workerId"])})
                
                # Get assigned to info
                assigned_to = None
                if is_valid_objectid(record.get("assignedTo", "")):
                    assigned_to = users_col.find_one({"_id": ObjectId(record["assignedTo"])})
                
                enriched_record = {
                    "_id": str(record["_id"]),
                    "workerId": record.get("workerId", ""),
                    "workerName": worker["name"] if worker else record.get("workerName", "Unknown Worker"),
                    "type": record.get("type", "Emergency"),
                    "location": record.get("location", "Unknown Location"),
                    "description": record.get("description", ""),
                    "photoUrl": record.get("photoUrl", ""),
                    "assignedTo": record.get("assignedTo", ""),
                    "assignedToName": assigned_to["name"] if assigned_to else "Unassigned",
                    "status": record.get("status", "Open"),
                    "priority": record.get("priority", "Medium"),
                    "timestamp": record.get("timestamp", ""),
                    "reportedBy": record.get("reportedBy", ""),
                    "reportedByName": reporter["name"] if reporter else "Unknown",
                    "resolved": record.get("resolved", False),
                    "resolution": record.get("resolution", ""),
                    "resolvedAt": record.get("resolvedAt", "")
                }
                enriched_records.append(enriched_record)
            
            return jsonify(enriched_records), 200
            
        except Exception as e:
            current_app.logger.error(f"Emergency fetch error: {str(e)}")
            return jsonify({"error": "Failed to fetch emergency data"}), 500
    
    elif request.method == "POST":
        try:
            decoded, error_response, status_code = verify_token()
            if error_response:
                return error_response, status_code
                
            data = request.json
            
            # Validate required fields
            required_fields = ["type", "location"]
            for field in required_fields:
                if field not in data:
                    return jsonify({"error": f"Missing required field: {field}"}), 400
            
            # Resolve worker name if workerId is provided
            worker_name = "Unknown Worker"
            if data.get("workerId"):
                if is_valid_objectid(data["workerId"]):
                    worker = users_col.find_one({"_id": ObjectId(data["workerId"])})
                    if worker:
                        worker_name = worker["name"]
                else:
                    worker_name = data["workerId"]
            
            # Create emergency record
            emergency_record = {
                "workerId": data.get("workerId", ""),
                "workerName": worker_name,
                "type": data["type"],
                "location": data["location"],
                "description": data.get("description", ""),
                "photoUrl": data.get("photoUrl", ""),
                "assignedTo": data.get("assignedTo", ""),
                "status": "Open",
                "priority": data.get("priority", "Medium"),
                "timestamp": datetime.now().isoformat(),
                "reportedBy": decoded.get("email", ""),
                "reportedByName": decoded.get("name", "Unknown"),
                "resolved": False,
                "resolution": "",
                "resolvedAt": ""
            }
            
            # Insert the emergency report
            result = emergency_col.insert_one(emergency_record)
            
            # Return the created record
            created_record = emergency_col.find_one({"_id": result.inserted_id})
            enriched_record = {
                "_id": str(created_record["_id"]),
                "workerId": created_record["workerId"],
                "workerName": created_record["workerName"],
                "type": created_record["type"],
                "location": created_record["location"],
                "description": created_record["description"],
                "photoUrl": created_record["photoUrl"],
                "assignedTo": created_record["assignedTo"],
                "status": created_record["status"],
                "priority": created_record["priority"],
                "timestamp": created_record["timestamp"],
                "reportedByName": created_record["reportedByName"]
            }
            
            return jsonify({
                "message": "Emergency reported successfully",
                "record": enriched_record
            }), 201
            
        except Exception as e:
            current_app.logger.error(f"Emergency creation error: {str(e)}")
            return jsonify({"error": "Failed to report emergency"}), 500

@emergency_bp.route("/emergencies/<emergency_id>", methods=["PUT"])
def emergency_detail(emergency_id):
    emergency_col = current_app.config["EMERGENCY_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        if request.method == "PUT":
            data = request.json
            
            # Validate emergency exists
            if not ObjectId.is_valid(emergency_id):
                return jsonify({"error": "Invalid emergency ID"}), 400
                
            emergency = emergency_col.find_one({"_id": ObjectId(emergency_id)})
            if not emergency:
                return jsonify({"error": "Emergency report not found"}), 404
            
            # Prepare update data
            update_data = {}
            if "status" in data:
                update_data["status"] = data["status"]
            if "assignedTo" in data:
                update_data["assignedTo"] = data["assignedTo"]
                # Resolve assigned to name
                if data["assignedTo"] and is_valid_objectid(data["assignedTo"]):
                    assigned_user = users_col.find_one({"_id": ObjectId(data["assignedTo"])})
                    if assigned_user:
                        update_data["assignedToName"] = assigned_user["name"]
            if "priority" in data:
                update_data["priority"] = data["priority"]
            if "resolved" in data:
                update_data["resolved"] = data["resolved"]
                if data["resolved"]:
                    update_data["resolvedAt"] = datetime.now().isoformat()
            if "resolution" in data:
                update_data["resolution"] = data["resolution"]
            
            # Update the emergency report
            result = emergency_col.update_one(
                {"_id": ObjectId(emergency_id)}, 
                {"$set": update_data}
            )
            
            if result.modified_count:
                # Return updated record
                updated_record = emergency_col.find_one({"_id": ObjectId(emergency_id)})
                
                # Get assigned to name if not already set
                assigned_to_name = updated_record.get("assignedToName", "Unassigned")
                if not assigned_to_name and updated_record.get("assignedTo"):
                    if is_valid_objectid(updated_record["assignedTo"]):
                        assigned_user = users_col.find_one({"_id": ObjectId(updated_record["assignedTo"])})
                        if assigned_user:
                            assigned_to_name = assigned_user["name"]
                
                enriched_record = {
                    "_id": str(updated_record["_id"]),
                    "workerId": updated_record["workerId"],
                    "workerName": updated_record.get("workerName", "Unknown Worker"),
                    "type": updated_record["type"],
                    "location": updated_record["location"],
                    "description": updated_record.get("description", ""),
                    "photoUrl": updated_record.get("photoUrl", ""),
                    "assignedTo": updated_record.get("assignedTo", ""),
                    "assignedToName": assigned_to_name,
                    "status": updated_record.get("status", "Open"),
                    "priority": updated_record.get("priority", "Medium"),
                    "timestamp": updated_record["timestamp"],
                    "reportedByName": updated_record.get("reportedByName", "Unknown"),
                    "resolved": updated_record.get("resolved", False),
                    "resolution": updated_record.get("resolution", ""),
                    "resolvedAt": updated_record.get("resolvedAt", "")
                }
                
                return jsonify({
                    "message": "Emergency updated successfully",
                    "record": enriched_record
                }), 200
            else:
                return jsonify({"error": "Emergency not found or no changes made"}), 404
                
    except Exception as e:
        current_app.logger.error(f"Emergency update error: {str(e)}")
        return jsonify({"error": "Failed to update emergency"}), 500

# ---------------- EMERGENCY STATS ----------------
@emergency_bp.route("/emergencies/stats", methods=["GET"])
def emergency_stats():
    emergency_col = current_app.config["EMERGENCY_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get today's date for filtering
        today = datetime.now().date()
        today_start = datetime(today.year, today.month, today.day)
        today_end = datetime(today.year, today.month, today.day, 23, 59, 59)
        
        # Calculate statistics
        total_emergencies = emergency_col.count_documents({})
        today_emergencies = emergency_col.count_documents({
            "timestamp": {
                "$gte": today_start.isoformat(),
                "$lte": today_end.isoformat()
            }
        })
        open_emergencies = emergency_col.count_documents({"status": "Open"})
        in_progress_emergencies = emergency_col.count_documents({"status": "In Progress"})
        resolved_emergencies = emergency_col.count_documents({"resolved": True})
        
        # Count by type
        sos_count = emergency_col.count_documents({"type": "SOS"})
        accident_count = emergency_col.count_documents({"type": "Accident"})
        medical_count = emergency_col.count_documents({"type": "Medical"})
        safety_count = emergency_col.count_documents({"type": "Safety"})
        other_count = emergency_col.count_documents({"type": {"$nin": ["SOS", "Accident", "Medical", "Safety"]}})
        
        return jsonify({
            "totalEmergencies": total_emergencies,
            "todayEmergencies": today_emergencies,
            "openEmergencies": open_emergencies,
            "inProgressEmergencies": in_progress_emergencies,
            "resolvedEmergencies": resolved_emergencies,
            "byType": {
                "SOS": sos_count,
                "Accident": accident_count,
                "Medical": medical_count,
                "Safety": safety_count,
                "Other": other_count
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Emergency stats error: {str(e)}")
        return jsonify({"error": "Failed to fetch emergency statistics"}), 500

# ---------------- GET ASSIGNABLE USERS ----------------
@emergency_bp.route("/emergencies/assignable-users", methods=["GET"])
def get_assignable_users():
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get users who can be assigned to emergencies (Managers and Supervisors)
        users = list(users_col.find(
            {"role": {"$in": ["Manager", "Supervisor"]}}, 
            {"_id": 1, "name": 1, "email": 1, "role": 1}
        ))
        
        # Format response
        users_list = []
        for user in users:
            users_list.append({
                "id": str(user["_id"]),
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
                "display": f"{user['name']} ({user['role']})"
            })
        
        return jsonify(users_list), 200
        
    except Exception as e:
        current_app.logger.error(f"Get assignable users error: {str(e)}")
        return jsonify({"error": "Failed to fetch assignable users"}), 500