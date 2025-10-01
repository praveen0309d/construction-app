# attendance_routes.py
from flask import Blueprint, request, jsonify, current_app
import jwt
import datetime
from bson import ObjectId
from datetime import datetime, date
import re

# Blueprint instance
attendance_bp = Blueprint("attendance", __name__)

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

# ---------------- GET ATTENDANCE RECORDS ----------------
@attendance_bp.route("/attendance", methods=["GET"])
def get_attendance():
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get query parameters for filtering
        worker_id = request.args.get('workerId')
        start_date = request.args.get('startDate')
        end_date = request.args.get('endDate')
        status = request.args.get('status')
        
        # Build query filter
        query = {}
        if worker_id:
            query["workerId"] = worker_id
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        elif start_date:
            query["date"] = {"$gte": start_date}
        elif end_date:
            query["date"] = {"$lte": end_date}
        if status:
            query["status"] = status
        
        # Get attendance records
        records = list(attendance_col.find(query))
        
        # Enrich records with worker information
        enriched_records = []
        for record in records:
            worker = None
            if is_valid_objectid(record["workerId"]):
                worker = users_col.find_one({"_id": ObjectId(record["workerId"])})
            else:
                # Try to find by email as fallback
                worker = users_col.find_one({"email": record["workerId"]})
            
            # Calculate hours worked
            hours_worked = 0
            if record.get("checkIn") and record.get("checkOut"):
                hours_worked = calculate_hours_worked(record["checkIn"], record["checkOut"])
            
            enriched_record = {
                "_id": str(record["_id"]),
                "workerId": record["workerId"],
                "workerName": worker["name"] if worker else record.get("workerName", "Unknown Worker"),
                "workerEmail": worker["email"] if worker else record["workerId"],
                "date": record["date"],
                "status": record["status"],
                "checkIn": record.get("checkIn", ""),
                "checkOut": record.get("checkOut", ""),
                "hoursWorked": hours_worked,
                "notes": record.get("notes", ""),
                "timestamp": record.get("timestamp", "")
            }
            enriched_records.append(enriched_record)
        
        return jsonify(enriched_records), 200
        
    except Exception as e:
        current_app.logger.error(f"Attendance fetch error: {str(e)}")
        return jsonify({"error": "Failed to fetch attendance data"}), 500

# ---------------- CREATE ATTENDANCE RECORD ----------------
@attendance_bp.route("/attendance", methods=["POST"])
def create_attendance():
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
            
        data = request.json
        
        # Validate required fields
        required_fields = ["workerId", "date", "status"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Validate worker exists
        worker = None
        worker_name = "Unknown Worker"
        
        if is_valid_objectid(data["workerId"]):
            worker = users_col.find_one({"_id": ObjectId(data["workerId"])})
            if worker:
                worker_name = worker["name"]
                data["workerId"] = str(worker["_id"])  # Store ID as string
            else:
                worker_name = f"Unknown (ID: {data['workerId']})"
        else:
            # Try to find by email
            worker = users_col.find_one({"email": data["workerId"]})
            if worker:
                worker_name = worker["name"]
                data["workerId"] = str(worker["_id"])  # Store ID instead of email
            else:
                worker_name = data["workerId"]  # Use as-is
        
        # Validate status
        valid_statuses = ["Present", "Absent", "Late", "Leave", "Half Day"]
        if data["status"] not in valid_statuses:
            return jsonify({"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}), 400
        
        # Check if record already exists for this worker and date
        existing_record = attendance_col.find_one({
            "workerId": data["workerId"],
            "date": data["date"]
        })
        
        if existing_record:
            return jsonify({"error": "Attendance record already exists for this worker and date"}), 400
        
        # Create attendance record
        attendance_record = {
            "workerId": data["workerId"],
            "workerName": worker_name,
            "date": data["date"],
            "status": data["status"],
            "checkIn": data.get("checkIn", ""),
            "checkOut": data.get("checkOut", ""),
            "notes": data.get("notes", ""),
            "createdBy": decoded["email"],
            "createdByName": decoded.get("name", "Unknown"),
            "timestamp": datetime.now().isoformat()
        }
        
        # Insert the attendance record
        result = attendance_col.insert_one(attendance_record)
        
        # Calculate hours worked for response
        hours_worked = calculate_hours_worked(attendance_record["checkIn"], attendance_record["checkOut"])
        
        # Return the created record
        return jsonify({
            "message": "Attendance record created successfully",
            "record": {
                "_id": str(result.inserted_id),
                "workerId": attendance_record["workerId"],
                "workerName": attendance_record["workerName"],
                "date": attendance_record["date"],
                "status": attendance_record["status"],
                "checkIn": attendance_record["checkIn"],
                "checkOut": attendance_record["checkOut"],
                "hoursWorked": hours_worked,
                "notes": attendance_record["notes"],
                "timestamp": attendance_record["timestamp"]
            }
        }), 201
        
    except Exception as e:
        current_app.logger.error(f"Attendance creation error: {str(e)}")
        return jsonify({"error": "Failed to create attendance record"}), 500

# ---------------- UPDATE ATTENDANCE RECORD ----------------
@attendance_bp.route("/attendance/<record_id>", methods=["PUT"])
def update_attendance(record_id):
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Validate record ID
        if not ObjectId.is_valid(record_id):
            return jsonify({"error": "Invalid record ID"}), 400
            
        # Check if record exists
        record = attendance_col.find_one({"_id": ObjectId(record_id)})
        if not record:
            return jsonify({"error": "Attendance record not found"}), 404
        
        data = request.json
        
        # Prepare update data
        update_data = {}
        allowed_fields = ["status", "checkIn", "checkOut", "notes"]
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        # Validate status if provided
        if "status" in update_data:
            valid_statuses = ["Present", "Absent", "Late", "Leave", "Half Day"]
            if update_data["status"] not in valid_statuses:
                return jsonify({"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}), 400
        
        # Update the attendance record
        result = attendance_col.update_one(
            {"_id": ObjectId(record_id)}, 
            {"$set": update_data}
        )
        
        if result.modified_count:
            # Return updated record
            updated_record = attendance_col.find_one({"_id": ObjectId(record_id)})
            
            # Calculate hours worked
            hours_worked = calculate_hours_worked(
                updated_record.get("checkIn", ""), 
                updated_record.get("checkOut", "")
            )
            
            # Find worker information
            worker = None
            if is_valid_objectid(updated_record["workerId"]):
                worker = users_col.find_one({"_id": ObjectId(updated_record["workerId"])})
            
            response_record = {
                "_id": str(updated_record["_id"]),
                "workerId": updated_record["workerId"],
                "workerName": worker["name"] if worker else updated_record.get("workerName", "Unknown Worker"),
                "workerEmail": worker["email"] if worker else updated_record["workerId"],
                "date": updated_record["date"],
                "status": updated_record["status"],
                "checkIn": updated_record.get("checkIn", ""),
                "checkOut": updated_record.get("checkOut", ""),
                "hoursWorked": hours_worked,
                "notes": updated_record.get("notes", ""),
                "timestamp": updated_record.get("timestamp", "")
            }
            
            return jsonify({
                "message": "Attendance record updated successfully",
                "record": response_record
            }), 200
        else:
            return jsonify({"error": "Record not found or no changes made"}), 404
                
    except Exception as e:
        current_app.logger.error(f"Attendance update error: {str(e)}")
        return jsonify({"error": "Failed to update attendance record"}), 500

# ---------------- DELETE ATTENDANCE RECORD ----------------
@attendance_bp.route("/attendance/<record_id>", methods=["DELETE"])
def delete_attendance(record_id):
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Validate record ID
        if not ObjectId.is_valid(record_id):
            return jsonify({"error": "Invalid record ID"}), 400
            
        # Delete the attendance record
        result = attendance_col.delete_one({"_id": ObjectId(record_id)})
        
        if result.deleted_count:
            return jsonify({"message": "Attendance record deleted successfully"}), 200
        else:
            return jsonify({"error": "Attendance record not found"}), 404
        
    except Exception as e:
        current_app.logger.error(f"Attendance deletion error: {str(e)}")
        return jsonify({"error": "Failed to delete attendance record"}), 500

# ---------------- ATTENDANCE STATS ----------------
@attendance_bp.route("/attendance/stats", methods=["GET"])
def attendance_stats():
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get query parameters
        start_date = request.args.get('startDate')
        end_date = request.args.get('endDate')
        worker_id = request.args.get('workerId')
        
        # Build query filter
        query = {}
        if worker_id:
            query["workerId"] = worker_id
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        
        # Get all matching records
        records = list(attendance_col.find(query))
        
        # Calculate statistics
        total_records = len(records)
        present_count = len([r for r in records if r["status"] == "Present"])
        absent_count = len([r for r in records if r["status"] == "Absent"])
        late_count = len([r for r in records if r["status"] == "Late"])
        leave_count = len([r for r in records if r["status"] == "Leave"])
        half_day_count = len([r for r in records if r["status"] == "Half Day"])
        
        # Calculate average hours worked for present records
        present_records = [r for r in records if r["status"] == "Present" and r.get("checkIn") and r.get("checkOut")]
        total_hours = sum(calculate_hours_worked(r["checkIn"], r["checkOut"]) for r in present_records)
        average_hours = total_hours / len(present_records) if present_records else 0
        
        # Calculate attendance rate
        attendance_rate = (present_count / total_records * 100) if total_records > 0 else 0
        
        return jsonify({
            "totalRecords": total_records,
            "presentCount": present_count,
            "absentCount": absent_count,
            "lateCount": late_count,
            "leaveCount": leave_count,
            "halfDayCount": half_day_count,
            "attendanceRate": round(attendance_rate, 2),
            "averageHours": round(average_hours, 2)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Attendance stats error: {str(e)}")
        return jsonify({"error": "Failed to fetch attendance statistics"}), 500

# ---------------- TODAY'S ATTENDANCE ----------------
@attendance_bp.route("/attendance/today", methods=["GET"])
def today_attendance():
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get today's date
        today = date.today().isoformat()
        
        # Get today's attendance records
        records = list(attendance_col.find({"date": today}))
        
        # Get all workers to check who hasn't marked attendance
        all_workers = list(users_col.find({"role": "Worker"}, {"_id": 1, "name": 1, "email": 1}))
        
        # Enrich today's records
        today_records = []
        for record in records:
            worker = users_col.find_one({"_id": ObjectId(record["workerId"])})
            hours_worked = calculate_hours_worked(record.get("checkIn", ""), record.get("checkOut", ""))
            
            today_records.append({
                "_id": str(record["_id"]),
                "workerId": record["workerId"],
                "workerName": worker["name"] if worker else record.get("workerName", "Unknown Worker"),
                "workerEmail": worker["email"] if worker else record["workerId"],
                "status": record["status"],
                "checkIn": record.get("checkIn", ""),
                "checkOut": record.get("checkOut", ""),
                "hoursWorked": hours_worked,
                "notes": record.get("notes", "")
            })
        
        # Find workers who haven't marked attendance today
        workers_with_attendance = {record["workerId"] for record in records}
        missing_workers = [
            {
                "workerId": str(worker["_id"]),
                "workerName": worker["name"],
                "workerEmail": worker["email"],
                "status": "Not Marked"
            }
            for worker in all_workers
            if str(worker["_id"]) not in workers_with_attendance
        ]
        
        return jsonify({
            "date": today,
            "records": today_records,
            "missingWorkers": missing_workers,
            "totalPresent": len([r for r in today_records if r["status"] == "Present"]),
            "totalAbsent": len([r for r in today_records if r["status"] == "Absent"]),
            "totalMissing": len(missing_workers)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Today's attendance error: {str(e)}")
        return jsonify({"error": "Failed to fetch today's attendance"}), 500

# ---------------- BULK ATTENDANCE UPDATE ----------------
@attendance_bp.route("/attendance/bulk", methods=["POST"])
def bulk_attendance():
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
            
        data = request.json
        
        # Validate required fields
        if "date" not in data or "entries" not in data:
            return jsonify({"error": "Missing required fields: date and entries"}), 400
        
        date_str = data["date"]
        entries = data["entries"]
        
        results = {
            "successful": [],
            "failed": []
        }
        
        for entry in entries:
            try:
                # Validate entry
                if "workerId" not in entry or "status" not in entry:
                    results["failed"].append({
                        "workerId": entry.get("workerId", "unknown"),
                        "error": "Missing workerId or status"
                    })
                    continue
                
                # Validate worker exists
                worker = None
                if is_valid_objectid(entry["workerId"]):
                    worker = users_col.find_one({"_id": ObjectId(entry["workerId"])})
                else:
                    worker = users_col.find_one({"email": entry["workerId"]})
                
                if not worker:
                    results["failed"].append({
                        "workerId": entry["workerId"],
                        "error": "Worker not found"
                    })
                    continue
                
                # Check if record already exists
                existing_record = attendance_col.find_one({
                    "workerId": str(worker["_id"]),
                    "date": date_str
                })
                
                if existing_record:
                    # Update existing record
                    update_data = {
                        "status": entry["status"],
                        "checkIn": entry.get("checkIn", ""),
                        "checkOut": entry.get("checkOut", ""),
                        "notes": entry.get("notes", "")
                    }
                    
                    attendance_col.update_one(
                        {"_id": existing_record["_id"]},
                        {"$set": update_data}
                    )
                    
                    results["successful"].append({
                        "workerId": str(worker["_id"]),
                        "workerName": worker["name"],
                        "action": "updated"
                    })
                else:
                    # Create new record
                    attendance_record = {
                        "workerId": str(worker["_id"]),
                        "workerName": worker["name"],
                        "date": date_str,
                        "status": entry["status"],
                        "checkIn": entry.get("checkIn", ""),
                        "checkOut": entry.get("checkOut", ""),
                        "notes": entry.get("notes", ""),
                        "createdBy": decoded["email"],
                        "createdByName": decoded.get("name", "Unknown"),
                        "timestamp": datetime.now().isoformat()
                    }
                    
                    attendance_col.insert_one(attendance_record)
                    
                    results["successful"].append({
                        "workerId": str(worker["_id"]),
                        "workerName": worker["name"],
                        "action": "created"
                    })
                    
            except Exception as e:
                results["failed"].append({
                    "workerId": entry.get("workerId", "unknown"),
                    "error": str(e)
                })
        
        return jsonify({
            "message": f"Bulk operation completed: {len(results['successful'])} successful, {len(results['failed'])} failed",
            "results": results
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Bulk attendance error: {str(e)}")
        return jsonify({"error": "Failed to process bulk attendance"}), 500

# Helper function to calculate hours worked
def calculate_hours_worked(check_in, check_out):
    if not check_in or not check_out:
        return 0
    
    try:
        # Parse time strings (format: "HH:MM")
        in_time = datetime.strptime(check_in, "%H:%M")
        out_time = datetime.strptime(check_out, "%H:%M")
        
        # Calculate difference in hours
        time_diff = out_time - in_time
        hours_worked = time_diff.total_seconds() / 3600
        
        return max(0, hours_worked)  # Ensure non-negative
    except:
        return 0