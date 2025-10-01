# task_routes.py
from flask import Blueprint, request, jsonify, current_app
import jwt
import datetime
from bson import ObjectId
from datetime import datetime
import re

# Blueprint instance
task_bp = Blueprint("tasks", __name__)

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

# ---------------- TASKS ----------------
@task_bp.route("/tasks", methods=["GET", "POST"])
def tasks():
    tasks_col = current_app.config["TASKS_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    if request.method == "GET":
        try:
            decoded, error_response, status_code = verify_token()
            if error_response:
                return error_response, status_code
            
            # Get all tasks
            tasks = list(tasks_col.find({}))
            
            # Enrich tasks with user information
            enriched_tasks = []
            for task in tasks:
                # Try to find user by email (original format) or ID
                user = None
                if is_valid_objectid(task["assignedTo"]):
                    user = users_col.find_one({"_id": ObjectId(task["assignedTo"])})
                else:
                    user = users_col.find_one({"email": task["assignedTo"]})
                
                enriched_task = {
                    "_id": str(task["_id"]),
                    "taskName": task["taskName"],
                    "description": task.get("description", ""),
                    "assignedTo": task["assignedTo"],
                    "assignedToName": user["name"] if user else task.get("assignedToName", "Unknown"),
                    "assignedToEmail": user["email"] if user else task["assignedTo"],
                    "deadline": task["deadline"],
                    "status": task["status"],
                    "priority": task.get("priority", "Medium"),
                    "createdAt": task.get("createdAt", ""),
                    "completedAt": task.get("completedAt", ""),
                    "comments": task.get("comments", "")
                }
                enriched_tasks.append(enriched_task)
            
            return jsonify(enriched_tasks), 200
            
        except Exception as e:
            current_app.logger.error(f"Tasks fetch error: {str(e)}")
            return jsonify({"error": "Failed to fetch tasks data"}), 500
    
    elif request.method == "POST":
        try:
            decoded, error_response, status_code = verify_token()
            if error_response:
                return error_response, status_code
                
            data = request.json
            
            # Validate required fields
            required_fields = ["taskName", "assignedTo", "deadline"]
            for field in required_fields:
                if field not in data:
                    return jsonify({"error": f"Missing required field: {field}"}), 400
            
            # Validate assignedTo - can be email or user ID
            users_col = current_app.config["USERS_COLLECTION"]
            user = None
            assigned_to_name = "Unknown"
            
            if is_valid_objectid(data["assignedTo"]):
                # Try to find by ObjectId
                user = users_col.find_one({"_id": ObjectId(data["assignedTo"])})
                if user:
                    assigned_to_name = user["name"]
                    data["assignedTo"] = user["email"]  # Store email for consistency
                else:
                    assigned_to_name = f"Unknown (ID: {data['assignedTo']})"
            else:
                # Try to find by email
                user = users_col.find_one({"email": data["assignedTo"]})
                if user:
                    assigned_to_name = user["name"]
                else:
                    assigned_to_name = data["assignedTo"]  # Use email/name as is
            
            # Create task document
            task = {
                "taskName": data["taskName"],
                "description": data.get("description", ""),
                "assignedTo": data["assignedTo"],
                "assignedToName": assigned_to_name,
                "deadline": data["deadline"],
                "status": data.get("status", "Pending"),
                "priority": data.get("priority", "Medium"),
                "createdBy": decoded["email"],
                "createdByName": decoded.get("name", "Unknown"),
                "createdAt": datetime.now().isoformat(),
                "completedAt": "",
                "comments": data.get("comments", "")
            }
            
            # Insert the task
            result = tasks_col.insert_one(task)
            task["_id"] = str(result.inserted_id)
            
            # Remove internal fields from response
            response_task = {k: v for k, v in task.items() if k not in ["createdBy", "createdByName"]}
            
            return jsonify({
                "message": "Task created successfully",
                "task": response_task
            }), 201
            
        except Exception as e:
            current_app.logger.error(f"Task creation error: {str(e)}")
            return jsonify({"error": "Failed to create task"}), 500

@task_bp.route("/tasks/<task_id>", methods=["GET", "PUT", "DELETE"])
def task_detail(task_id):
    tasks_col = current_app.config["TASKS_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        if not ObjectId.is_valid(task_id):
            return jsonify({"error": "Invalid task ID"}), 400
            
        task = tasks_col.find_one({"_id": ObjectId(task_id)})
        if not task:
            return jsonify({"error": "Task not found"}), 404
        
        if request.method == "GET":
            # Find user information
            user = None
            if is_valid_objectid(task["assignedTo"]):
                user = users_col.find_one({"_id": ObjectId(task["assignedTo"])})
            else:
                user = users_col.find_one({"email": task["assignedTo"]})
            
            enriched_task = {
                "_id": str(task["_id"]),
                "taskName": task["taskName"],
                "description": task.get("description", ""),
                "assignedTo": task["assignedTo"],
                "assignedToName": user["name"] if user else task.get("assignedToName", "Unknown"),
                "assignedToEmail": user["email"] if user else task["assignedTo"],
                "deadline": task["deadline"],
                "status": task["status"],
                "priority": task.get("priority", "Medium"),
                "createdAt": task.get("createdAt", ""),
                "completedAt": task.get("completedAt", ""),
                "comments": task.get("comments", ""),
                "createdBy": task.get("createdBy", ""),
                "createdByName": task.get("createdByName", "")
            }
            
            return jsonify(enriched_task), 200
            
        elif request.method == "PUT":
            data = request.json
            
            # Prepare update data
            update_data = {}
            updatable_fields = ["taskName", "description", "assignedTo", "deadline", "status", "priority", "comments"]
            
            for field in updatable_fields:
                if field in data:
                    update_data[field] = data[field]
            
            # If assignedTo is changed, update assignedToName
            if "assignedTo" in data:
                user = None
                if is_valid_objectid(data["assignedTo"]):
                    user = users_col.find_one({"_id": ObjectId(data["assignedTo"])})
                    if user:
                        update_data["assignedTo"] = user["email"]  # Store email for consistency
                        update_data["assignedToName"] = user["name"]
                    else:
                        update_data["assignedToName"] = f"Unknown (ID: {data['assignedTo']})"
                else:
                    user = users_col.find_one({"email": data["assignedTo"]})
                    if user:
                        update_data["assignedToName"] = user["name"]
                    else:
                        update_data["assignedToName"] = data["assignedTo"]
            
            # Handle status changes
            if "status" in data:
                if data["status"] in ["Completed", "Approved"] and task["status"] not in ["Completed", "Approved"]:
                    update_data["completedAt"] = datetime.now().isoformat()
                elif data["status"] in ["Pending", "In Progress", "Rejected"] and task["status"] in ["Completed", "Approved"]:
                    update_data["completedAt"] = ""
            
            # Update the task
            result = tasks_col.update_one(
                {"_id": ObjectId(task_id)}, 
                {"$set": update_data}
            )
            
            if result.modified_count:
                # Return updated task
                updated_task = tasks_col.find_one({"_id": ObjectId(task_id)})
                
                # Find user information for response
                user = None
                if is_valid_objectid(updated_task["assignedTo"]):
                    user = users_col.find_one({"_id": ObjectId(updated_task["assignedTo"])})
                else:
                    user = users_col.find_one({"email": updated_task["assignedTo"]})
                
                enriched_task = {
                    "_id": str(updated_task["_id"]),
                    "taskName": updated_task["taskName"],
                    "description": updated_task.get("description", ""),
                    "assignedTo": updated_task["assignedTo"],
                    "assignedToName": user["name"] if user else updated_task.get("assignedToName", "Unknown"),
                    "assignedToEmail": user["email"] if user else updated_task["assignedTo"],
                    "deadline": updated_task["deadline"],
                    "status": updated_task["status"],
                    "priority": updated_task.get("priority", "Medium"),
                    "createdAt": updated_task.get("createdAt", ""),
                    "completedAt": updated_task.get("completedAt", ""),
                    "comments": updated_task.get("comments", "")
                }
                
                return jsonify({
                    "message": "Task updated successfully",
                    "task": enriched_task
                }), 200
            else:
                return jsonify({"error": "Task not found or no changes made"}), 404
                
        elif request.method == "DELETE":
            result = tasks_col.delete_one({"_id": ObjectId(task_id)})
            
            if result.deleted_count:
                return jsonify({"message": "Task deleted successfully"}), 200
            else:
                return jsonify({"error": "Task not found"}), 404
                
    except Exception as e:
        current_app.logger.error(f"Task operation error: {str(e)}")
        return jsonify({"error": "Failed to perform task operation"}), 500

# ---------------- TASK STATS ----------------
@task_bp.route("/tasks/stats", methods=["GET"])
def task_stats():
    tasks_col = current_app.config["TASKS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Calculate statistics
        total_tasks = tasks_col.count_documents({})
        pending_tasks = tasks_col.count_documents({"status": "Pending"})
        in_progress_tasks = tasks_col.count_documents({"status": "In Progress"})
        completed_tasks = tasks_col.count_documents({"status": "Completed"})
        approved_tasks = tasks_col.count_documents({"status": "Approved"})
        rejected_tasks = tasks_col.count_documents({"status": "Rejected"})
        
        # Count overdue tasks (deadline is in the past and status is not completed/approved)
        today = datetime.now().date().isoformat()
        overdue_tasks = tasks_col.count_documents({
            "deadline": {"$lt": today},
            "status": {"$nin": ["Completed", "Approved"]}
        })
        
        return jsonify({
            "totalTasks": total_tasks,
            "pendingTasks": pending_tasks,
            "inProgressTasks": in_progress_tasks,
            "completedTasks": completed_tasks,
            "approvedTasks": approved_tasks,
            "rejectedTasks": rejected_tasks,
            "overdueTasks": overdue_tasks
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Task stats error: {str(e)}")
        return jsonify({"error": "Failed to fetch task statistics"}), 500

# ---------------- USER TASKS ----------------
@task_bp.route("/tasks/user/<user_identifier>", methods=["GET"])
def user_tasks(user_identifier):
    tasks_col = current_app.config["TASKS_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Find user by ID or email
        user = None
        if is_valid_objectid(user_identifier):
            user = users_col.find_one({"_id": ObjectId(user_identifier)})
        else:
            user = users_col.find_one({"email": user_identifier})
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        # Get tasks assigned to this user (by email)
        tasks = list(tasks_col.find({"assignedTo": user["email"]}))
        
        # Enrich tasks
        enriched_tasks = []
        for task in tasks:
            enriched_task = {
                "_id": str(task["_id"]),
                "taskName": task["taskName"],
                "description": task.get("description", ""),
                "assignedTo": task["assignedTo"],
                "assignedToName": user["name"],
                "assignedToEmail": user["email"],
                "deadline": task["deadline"],
                "status": task["status"],
                "priority": task.get("priority", "Medium"),
                "createdAt": task.get("createdAt", ""),
                "completedAt": task.get("completedAt", ""),
                "comments": task.get("comments", "")
            }
            enriched_tasks.append(enriched_task)
        
        return jsonify({
            "user": {
                "id": str(user["_id"]),
                "name": user["name"],
                "email": user["email"]
            },
            "tasks": enriched_tasks
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"User tasks error: {str(e)}")
        return jsonify({"error": "Failed to fetch user tasks"}), 500