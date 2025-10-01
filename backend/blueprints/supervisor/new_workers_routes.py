# new_workers_routes.py
from flask import Blueprint, request, jsonify, current_app
import jwt
import datetime
from bson import ObjectId
from datetime import datetime
import re

# Blueprint instance
new_workers_bp = Blueprint("new_workers", __name__)

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

# ---------------- NEW WORKERS MANAGEMENT ----------------
@new_workers_bp.route("/new-workers", methods=["GET"])
def get_new_workers():
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get query parameters for filtering
        status_filter = request.args.get('status', 'all')
        team_filter = request.args.get('team', 'all')
        
        # Build query for new workers (created in last 30 days)
        thirty_days_ago = (datetime.now() - datetime.timedelta(days=30)).isoformat()
        
        query = {
            "role": "Worker",
            "created_at": {"$gte": thirty_days_ago}
        }
        
        if status_filter != 'all':
            query["status"] = status_filter
        
        if team_filter != 'all':
            query["team"] = team_filter
        
        # Get new workers with sorting (newest first)
        new_workers = list(users_col.find(query, {"password": 0}).sort("created_at", -1))
        
        # Enrich with additional data
        enriched_workers = []
        for worker in new_workers:
            # Calculate days since joining
            join_date = worker.get("created_at")
            days_since_join = 0
            if join_date:
                if isinstance(join_date, str):
                    join_date = datetime.fromisoformat(join_date.replace('Z', '+00:00'))
                days_since_join = (datetime.now() - join_date).days
            
            enriched_worker = {
                "_id": str(worker["_id"]),
                "name": worker["name"],
                "email": worker["email"],
                "phone": worker.get("phone", ""),
                "position": worker.get("position", "Worker"),
                "team": worker.get("team", "Unassigned"),
                "status": worker.get("status", "active"),
                "created_at": worker.get("created_at", ""),
                "days_since_join": days_since_join,
                "supervisor": worker.get("supervisor", ""),
                "shift": worker.get("shift", "Day"),
                "hourly_rate": worker.get("hourly_rate", 0),
                "emergency_contact": worker.get("emergency_contact", {}),
                "skills": worker.get("skills", []),
                "certifications": worker.get("certifications", []),
                "onboarding_status": worker.get("onboarding_status", "pending"),
                "training_completed": worker.get("training_completed", False),
                "safety_training_date": worker.get("safety_training_date", ""),
                "notes": worker.get("notes", "")
            }
            enriched_workers.append(enriched_worker)
        
        return jsonify(enriched_workers), 200
        
    except Exception as e:
        current_app.logger.error(f"New workers fetch error: {str(e)}")
        return jsonify({"error": "Failed to fetch new workers"}), 500

@new_workers_bp.route("/new-workers", methods=["POST"])
def create_new_worker():
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        data = request.json
        
        # Validate required fields
        required_fields = ["name", "email", "password", "position"]
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Check if user already exists
        if users_col.find_one({"email": data["email"]}):
            return jsonify({"error": "User with this email already exists"}), 400
        
        # Create new worker
        new_worker = {
            "name": data["name"],
            "email": data["email"],
            "password": data["password"],  # In production, this should be hashed
            "role": "Worker",
            "position": data["position"],
            "phone": data.get("phone", ""),
            "team": data.get("team", "Unassigned"),
            "status": data.get("status", "active"),
            "created_at": datetime.now().isoformat(),
            "supervisor": data.get("supervisor", ""),
            "shift": data.get("shift", "Day"),
            "hourly_rate": data.get("hourly_rate", 0),
            "emergency_contact": data.get("emergency_contact", {
                "name": "",
                "phone": "",
                "relationship": ""
            }),
            "skills": data.get("skills", []),
            "certifications": data.get("certifications", []),
            "onboarding_status": data.get("onboarding_status", "pending"),
            "training_completed": data.get("training_completed", False),
            "safety_training_date": data.get("safety_training_date", ""),
            "notes": data.get("notes", "")
        }
        
        # Insert new worker
        result = users_col.insert_one(new_worker)
        
        # Return created worker (without password)
        created_worker = users_col.find_one({"_id": result.inserted_id}, {"password": 0})
        
        return jsonify({
            "message": "New worker created successfully",
            "worker": {
                "_id": str(created_worker["_id"]),
                "name": created_worker["name"],
                "email": created_worker["email"],
                "position": created_worker["position"],
                "team": created_worker.get("team", "Unassigned"),
                "status": created_worker.get("status", "active")
            }
        }), 201
        
    except Exception as e:
        current_app.logger.error(f"New worker creation error: {str(e)}")
        return jsonify({"error": "Failed to create new worker"}), 500

@new_workers_bp.route("/new-workers/<worker_id>", methods=["PUT"])
def update_new_worker(worker_id):
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        data = request.json
        
        # Validate worker ID
        if not ObjectId.is_valid(worker_id):
            return jsonify({"error": "Invalid worker ID"}), 400
        
        # Check if worker exists
        worker = users_col.find_one({"_id": ObjectId(worker_id)})
        if not worker:
            return jsonify({"error": "Worker not found"}), 404
        
        # Prepare update data (only allow certain fields to be updated)
        allowed_fields = [
            "name", "phone", "position", "team", "status", "supervisor",
            "shift", "hourly_rate", "emergency_contact", "skills",
            "certifications", "onboarding_status", "training_completed",
            "safety_training_date", "notes"
        ]
        
        update_data = {}
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        # Update the worker
        result = users_col.update_one(
            {"_id": ObjectId(worker_id)}, 
            {"$set": update_data}
        )
        
        if result.modified_count:
            # Get updated worker
            updated_worker = users_col.find_one({"_id": ObjectId(worker_id)}, {"password": 0})
            
            return jsonify({
                "message": "Worker updated successfully",
                "worker": {
                    "_id": str(updated_worker["_id"]),
                    "name": updated_worker["name"],
                    "email": updated_worker["email"],
                    "position": updated_worker["position"],
                    "team": updated_worker.get("team", "Unassigned"),
                    "status": updated_worker.get("status", "active")
                }
            }), 200
        else:
            return jsonify({"error": "Worker not found or no changes made"}), 404
            
    except Exception as e:
        current_app.logger.error(f"Worker update error: {str(e)}")
        return jsonify({"error": "Failed to update worker"}), 500

@new_workers_bp.route("/new-workers/<worker_id>", methods=["DELETE"])
def delete_new_worker(worker_id):
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Validate worker ID
        if not ObjectId.is_valid(worker_id):
            return jsonify({"error": "Invalid worker ID"}), 400
        
        # Check if worker exists
        worker = users_col.find_one({"_id": ObjectId(worker_id)})
        if not worker:
            return jsonify({"error": "Worker not found"}), 404
        
        # Delete the worker
        result = users_col.delete_one({"_id": ObjectId(worker_id)})
        
        if result.deleted_count:
            return jsonify({"message": "Worker deleted successfully"}), 200
        else:
            return jsonify({"error": "Worker not found"}), 404
            
    except Exception as e:
        current_app.logger.error(f"Worker deletion error: {str(e)}")
        return jsonify({"error": "Failed to delete worker"}), 500

@new_workers_bp.route("/new-workers/stats", methods=["GET"])
def new_workers_stats():
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get date range for new workers (last 30 days)
        thirty_days_ago = (datetime.now() - datetime.timedelta(days=30)).isoformat()
        
        # Calculate statistics
        total_new_workers = users_col.count_documents({
            "role": "Worker",
            "created_at": {"$gte": thirty_days_ago}
        })
        
        # Count by status
        active_workers = users_col.count_documents({
            "role": "Worker",
            "created_at": {"$gte": thirty_days_ago},
            "status": "active"
        })
        
        inactive_workers = users_col.count_documents({
            "role": "Worker",
            "created_at": {"$gte": thirty_days_ago},
            "status": "inactive"
        })
        
        # Count by team
        pipeline = [
            {
                "$match": {
                    "role": "Worker",
                    "created_at": {"$gte": thirty_days_ago}
                }
            },
            {
                "$group": {
                    "_id": "$team",
                    "count": {"$sum": 1}
                }
            }
        ]
        
        team_stats = list(users_col.aggregate(pipeline))
        
        # Count by onboarding status
        onboarding_pipeline = [
            {
                "$match": {
                    "role": "Worker",
                    "created_at": {"$gte": thirty_days_ago}
                }
            },
            {
                "$group": {
                    "_id": "$onboarding_status",
                    "count": {"$sum": 1}
                }
            }
        ]
        
        onboarding_stats = list(users_col.aggregate(onboarding_pipeline))
        
        # Weekly onboarding trends
        weekly_trends = []
        for i in range(4):
            week_start = (datetime.now() - datetime.timedelta(weeks=i+1)).date()
            week_end = (datetime.now() - datetime.timedelta(weeks=i)).date()
            
            week_start_dt = datetime.combine(week_start, datetime.min.time())
            week_end_dt = datetime.combine(week_end, datetime.max.time())
            
            week_count = users_col.count_documents({
                "role": "Worker",
                "created_at": {
                    "$gte": week_start_dt.isoformat(),
                    "$lte": week_end_dt.isoformat()
                }
            })
            
            weekly_trends.append({
                "week": f"Week {4-i}",
                "startDate": week_start.isoformat(),
                "endDate": week_end.isoformat(),
                "count": week_count
            })
        
        # Reverse to show chronological order
        weekly_trends.reverse()
        
        return jsonify({
            "totalNewWorkers": total_new_workers,
            "activeWorkers": active_workers,
            "inactiveWorkers": inactive_workers,
            "teamDistribution": team_stats,
            "onboardingStatus": onboarding_stats,
            "weeklyTrends": weekly_trends,
            "timeRange": {
                "startDate": thirty_days_ago,
                "days": 30
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"New workers stats error: {str(e)}")
        return jsonify({"error": "Failed to fetch new workers statistics"}), 500

@new_workers_bp.route("/new-workers/onboarding-checklist", methods=["GET"])
def get_onboarding_checklist():
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Standard onboarding checklist for new workers
        onboarding_checklist = [
            {
                "id": 1,
                "task": "Safety Training Completion",
                "description": "Complete mandatory safety training program",
                "required": True,
                "department": "Safety"
            },
            {
                "id": 2,
                "task": "Equipment Assignment",
                "description": "Assign necessary safety equipment and tools",
                "required": True,
                "department": "Inventory"
            },
            {
                "id": 3,
                "task": "Site Orientation",
                "description": "Conduct site tour and orientation",
                "required": True,
                "department": "Supervision"
            },
            {
                "id": 4,
                "task": "Paperwork Completion",
                "description": "Complete all employment paperwork",
                "required": True,
                "department": "HR"
            },
            {
                "id": 5,
                "task": "Team Introduction",
                "description": "Introduce to team members and supervisor",
                "required": True,
                "department": "Supervision"
            },
            {
                "id": 6,
                "task": "System Access",
                "description": "Set up system accounts and access",
                "required": True,
                "department": "IT"
            },
            {
                "id": 7,
                "task": "First Aid Certification",
                "description": "Complete basic first aid training",
                "required": False,
                "department": "Safety"
            },
            {
                "id": 8,
                "task": "Specialized Training",
                "description": "Job-specific skill training",
                "required": False,
                "department": "Training"
            }
        ]
        
        return jsonify(onboarding_checklist), 200
        
    except Exception as e:
        current_app.logger.error(f"Onboarding checklist error: {str(e)}")
        return jsonify({"error": "Failed to fetch onboarding checklist"}), 500