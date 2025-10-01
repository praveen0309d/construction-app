# safety_routes.py
from flask import Blueprint, request, jsonify, current_app
import jwt
import datetime
from bson import ObjectId
from datetime import datetime
import re

# Blueprint instance
safety_bp = Blueprint("safety", __name__)

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

# ---------------- SAFETY COMPLIANCE ----------------
@safety_bp.route("/safety/compliance", methods=["GET", "POST"])
def safety_compliance():
    safety_col = current_app.config["SAFETY_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    if request.method == "GET":
        try:
            # Get all safety compliance records with user details
            records = list(safety_col.find({}))
            
            # Enrich records with user information
            enriched_records = []
            for record in records:
                user = None
                if is_valid_objectid(record["workerId"]):
                    user = users_col.find_one({"_id": ObjectId(record["workerId"])})
                
                enriched_record = {
                    "_id": str(record["_id"]),
                    "workerId": record["workerId"],
                    "workerName": user["name"] if user else record.get("workerName", f"Unknown (ID: {record['workerId']})"),
                    "helmet": record["helmet"],
                    "vest": record["vest"],
                    "violations": record["violations"],
                    "timestamp": record["timestamp"],
                    "status": record.get("status", "Pending Review"),
                    "resolved": record.get("resolved", False),
                    "resolution": record.get("resolution", "")
                }
                enriched_records.append(enriched_record)
            
            return jsonify(enriched_records), 200
            
        except Exception as e:
            current_app.logger.error(f"Safety compliance fetch error: {str(e)}")
            return jsonify({"error": "Failed to fetch safety compliance data"}), 500
    
    elif request.method == "POST":
        try:
            decoded, error_response, status_code = verify_token()
            if error_response:
                return error_response, status_code
                
            data = request.json
            
            # Validate required fields
            required_fields = ["workerId", "helmet", "vest"]
            for field in required_fields:
                if field not in data:
                    return jsonify({"error": f"Missing required field: {field}"}), 400
            
            # Check if workerId is a valid ObjectId or use as-is for email/name
            worker = None
            worker_name = "Unknown Worker"
            
            if is_valid_objectid(data["workerId"]):
                # Try to find by ObjectId
                worker = users_col.find_one({"_id": ObjectId(data["workerId"])})
                if worker:
                    worker_name = worker["name"]
                else:
                    worker_name = f"Unknown (ID: {data['workerId']})"
            else:
                # Try to find by email or name
                worker_by_email = users_col.find_one({"email": data["workerId"]})
                if worker_by_email:
                    worker = worker_by_email
                    worker_name = worker_by_email["name"]
                    data["workerId"] = str(worker_by_email["_id"])  # Store ID instead of email
                else:
                    worker_by_name = users_col.find_one({"name": data["workerId"]})
                    if worker_by_name:
                        worker = worker_by_name
                        worker_name = worker_by_name["name"]
                        data["workerId"] = str(worker_by_name["_id"])  # Store ID instead of name
                    else:
                        # Use the provided value as the worker name
                        worker_name = data["workerId"]
            
            # Determine violations based on safety gear
            violations = []
            if not data["helmet"]:
                violations.append("No helmet")
            if not data["vest"]:
                violations.append("No safety vest")
            
            # Create safety compliance record
            safety_record = {
                "workerId": data["workerId"],
                "workerName": worker_name,  # Store the resolved name
                "helmet": data["helmet"],
                "vest": data["vest"],
                "violations": violations,
                "timestamp": datetime.now().isoformat(),
                "reportedBy": decoded["email"],
                "reportedByName": decoded.get("name", "Unknown"),
                "status": "Pending Review",
                "resolved": False,
                "resolution": ""
            }
            
            # Insert the safety report
            result = safety_col.insert_one(safety_record)
            
            # Return the created record
            created_record = safety_col.find_one({"_id": result.inserted_id})
            enriched_record = {
                "_id": str(created_record["_id"]),
                "workerId": created_record["workerId"],
                "workerName": created_record["workerName"],
                "helmet": created_record["helmet"],
                "vest": created_record["vest"],
                "violations": created_record["violations"],
                "timestamp": created_record["timestamp"],
                "status": created_record["status"],
                "resolved": created_record["resolved"],
                "resolution": created_record.get("resolution", "")
            }
            
            return jsonify({
                "message": "Safety compliance report submitted successfully",
                "record": enriched_record
            }), 201
            
        except Exception as e:
            current_app.logger.error(f"Safety compliance creation error: {str(e)}")
            return jsonify({"error": "Failed to create safety compliance report"}), 500

@safety_bp.route("/safety/compliance/<report_id>", methods=["PUT"])
def safety_compliance_detail(report_id):
    safety_col = current_app.config["SAFETY_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        if request.method == "PUT":
            data = request.json
            
            # Validate report exists
            if not ObjectId.is_valid(report_id):
                return jsonify({"error": "Invalid report ID"}), 400
                
            report = safety_col.find_one({"_id": ObjectId(report_id)})
            if not report:
                return jsonify({"error": "Safety report not found"}), 404
            
            # Prepare update data
            update_data = {}
            if "status" in data:
                update_data["status"] = data["status"]
            if "resolved" in data:
                update_data["resolved"] = data["resolved"]
            if "resolution" in data:
                update_data["resolution"] = data["resolution"]
            if "helmet" in data or "vest" in data:
                # If safety gear is updated, recalculate violations
                helmet = data.get("helmet", report["helmet"])
                vest = data.get("vest", report["vest"])
                violations = []
                if not helmet:
                    violations.append("No helmet")
                if not vest:
                    violations.append("No safety vest")
                update_data["violations"] = violations
                if "helmet" in data:
                    update_data["helmet"] = data["helmet"]
                if "vest" in data:
                    update_data["vest"] = data["vest"]
            
            # Update the safety report
            result = safety_col.update_one(
                {"_id": ObjectId(report_id)}, 
                {"$set": update_data}
            )
            
            if result.modified_count:
                # Return updated record
                updated_record = safety_col.find_one({"_id": ObjectId(report_id)})
                
                enriched_record = {
                    "_id": str(updated_record["_id"]),
                    "workerId": updated_record["workerId"],
                    "workerName": updated_record.get("workerName", "Unknown"),
                    "helmet": updated_record["helmet"],
                    "vest": updated_record["vest"],
                    "violations": updated_record["violations"],
                    "timestamp": updated_record["timestamp"],
                    "status": updated_record.get("status", "Pending Review"),
                    "resolved": updated_record.get("resolved", False),
                    "resolution": updated_record.get("resolution", "")
                }
                
                return jsonify({
                    "message": "Safety report updated successfully",
                    "record": enriched_record
                }), 200
            else:
                return jsonify({"error": "Report not found or no changes made"}), 404
                
    except Exception as e:
        current_app.logger.error(f"Safety compliance update error: {str(e)}")
        return jsonify({"error": "Failed to update safety compliance report"}), 500

# ---------------- GET WORKERS FOR AUTOCOMPLETE ----------------
@safety_bp.route("/safety/workers", methods=["GET"])
def get_workers():
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get all workers (users with role "Worker")
        workers = list(users_col.find(
            {"role": "Worker"}, 
            {"_id": 1, "name": 1, "email": 1}
        ))
        
        # Format response
        workers_list = []
        for worker in workers:
            workers_list.append({
                "id": str(worker["_id"]),
                "name": worker["name"],
                "email": worker["email"],
                "display": f"{worker['name']} ({worker['email']})"
            })
        
        return jsonify(workers_list), 200
        
    except Exception as e:
        current_app.logger.error(f"Get workers error: {str(e)}")
        return jsonify({"error": "Failed to fetch workers"}), 500

# ---------------- SAFETY STATS ----------------
@safety_bp.route("/safety/stats", methods=["GET"])
def safety_stats():
    safety_col = current_app.config["SAFETY_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get today's date for filtering
        today = datetime.now().date()
        today_start = datetime(today.year, today.month, today.day)
        today_end = datetime(today.year, today.month, today.day, 23, 59, 59)
        
        # Calculate statistics
        total_reports = safety_col.count_documents({})
        today_reports = safety_col.count_documents({
            "timestamp": {
                "$gte": today_start.isoformat(),
                "$lte": today_end.isoformat()
            }
        })
        unresolved_reports = safety_col.count_documents({"resolved": False})
        helmet_violations = safety_col.count_documents({"helmet": False})
        vest_violations = safety_col.count_documents({"vest": False})
        
        return jsonify({
            "totalReports": total_reports,
            "todayReports": today_reports,
            "unresolvedReports": unresolved_reports,
            "helmetViolations": helmet_violations,
            "vestViolations": vest_violations
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Safety stats error: {str(e)}")
        return jsonify({"error": "Failed to fetch safety statistics"}), 500