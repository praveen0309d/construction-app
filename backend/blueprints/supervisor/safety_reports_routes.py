# safety_reports_routes.py
from flask import Blueprint, request, jsonify, current_app
import jwt
import datetime
from bson import ObjectId
from datetime import datetime, timedelta
import re

# Blueprint instance
safety_reports_bp = Blueprint("safety_reports", __name__)

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

# ---------------- SAFETY REPORTS ----------------
@safety_reports_bp.route("/safety-reports", methods=["GET"])
def get_safety_reports():
    safety_col = current_app.config["SAFETY_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get query parameters for filtering
        status_filter = request.args.get('status', 'all')
        resolved_filter = request.args.get('resolved', 'all')
        worker_filter = request.args.get('worker', 'all')
        date_filter = request.args.get('date', 'all')
        
        # Build query based on filters
        query = {}
        
        if status_filter != 'all':
            query["status"] = status_filter
        
        if resolved_filter != 'all':
            query["resolved"] = resolved_filter.lower() == 'true'
        
        if worker_filter != 'all':
            if is_valid_objectid(worker_filter):
                query["workerId"] = worker_filter
            else:
                # Try to find worker by name
                worker = users_col.find_one({"name": worker_filter, "role": "Worker"})
                if worker:
                    query["workerId"] = str(worker["_id"])
        
        if date_filter != 'all':
            try:
                filter_date = datetime.strptime(date_filter, "%Y-%m-%d").date()
                start_of_day = datetime.combine(filter_date, datetime.min.time())
                end_of_day = datetime.combine(filter_date, datetime.max.time())
                query["timestamp"] = {
                    "$gte": start_of_day.isoformat(),
                    "$lte": end_of_day.isoformat()
                }
            except ValueError:
                pass
        
        # Get safety reports with sorting (newest first)
        reports = list(safety_col.find(query).sort("timestamp", -1))
        
        # Enrich reports with additional worker information
        enriched_reports = []
        for report in reports:
            # Get worker details
            worker = None
            if is_valid_objectid(report.get("workerId", "")):
                worker = users_col.find_one({"_id": ObjectId(report["workerId"])})
            
            # Get reporter details
            reporter = None
            if report.get("reportedBy"):
                reporter = users_col.find_one({"email": report["reportedBy"]})
            
            enriched_report = {
                "_id": str(report["_id"]),
                "workerId": report.get("workerId", ""),
                "workerName": report.get("workerName", worker["name"] if worker else "Unknown Worker"),
                "workerDetails": {
                    "position": worker.get("position", "Worker") if worker else "Unknown",
                    "team": worker.get("team", "No team assigned") if worker else "Unknown"
                },
                "helmet": report.get("helmet", False),
                "vest": report.get("vest", False),
                "violations": report.get("violations", []),
                "timestamp": report.get("timestamp", ""),
                "reportedBy": report.get("reportedBy", ""),
                "reportedByName": report.get("reportedByName", reporter["name"] if reporter else "Unknown"),
                "reportedByRole": reporter["role"] if reporter else "Unknown",
                "status": report.get("status", "Pending Review"),
                "resolved": report.get("resolved", False),
                "resolution": report.get("resolution", ""),
                "resolvedAt": report.get("resolvedAt", ""),
                "location": report.get("location", "Unknown Location"),
                "description": report.get("description", ""),
                "severity": report.get("severity", "medium")
            }
            enriched_reports.append(enriched_report)
        
        return jsonify(enriched_reports), 200
        
    except Exception as e:
        current_app.logger.error(f"Safety reports fetch error: {str(e)}")
        return jsonify({"error": "Failed to fetch safety reports"}), 500

@safety_reports_bp.route("/safety-reports/<report_id>", methods=["GET"])
def get_safety_report(report_id):
    safety_col = current_app.config["SAFETY_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Validate report ID
        if not ObjectId.is_valid(report_id):
            return jsonify({"error": "Invalid report ID"}), 400
        
        # Get safety report
        report = safety_col.find_one({"_id": ObjectId(report_id)})
        if not report:
            return jsonify({"error": "Safety report not found"}), 404
        
        # Get worker details
        worker = None
        if is_valid_objectid(report.get("workerId", "")):
            worker = users_col.find_one({"_id": ObjectId(report["workerId"])})
        
        # Get reporter details
        reporter = None
        if report.get("reportedBy"):
            reporter = users_col.find_one({"email": report["reportedBy"]})
        
        # Get resolver details if resolved
        resolver = None
        if report.get("resolvedBy"):
            if is_valid_objectid(report["resolvedBy"]):
                resolver = users_col.find_one({"_id": ObjectId(report["resolvedBy"])})
            else:
                resolver = users_col.find_one({"email": report["resolvedBy"]})
        
        # Get worker's safety history
        worker_safety_history = []
        if report.get("workerId"):
            worker_history = list(safety_col.find({
                "workerId": report["workerId"],
                "_id": {"$ne": ObjectId(report_id)}
            }).sort("timestamp", -1).limit(5))
            
            for history in worker_history:
                worker_safety_history.append({
                    "date": history.get("timestamp", ""),
                    "violations": history.get("violations", []),
                    "status": history.get("status", ""),
                    "resolved": history.get("resolved", False)
                })
        
        enriched_report = {
            "_id": str(report["_id"]),
            "workerId": report.get("workerId", ""),
            "workerName": report.get("workerName", worker["name"] if worker else "Unknown Worker"),
            "workerDetails": {
                "email": worker["email"] if worker else "Unknown",
                "phone": worker.get("phone", "Not provided") if worker else "Unknown",
                "position": worker.get("position", "Worker") if worker else "Unknown",
                "team": worker.get("team", "No team assigned") if worker else "Unknown",
                "status": worker.get("status", "active") if worker else "Unknown"
            },
            "helmet": report.get("helmet", False),
            "vest": report.get("vest", False),
            "violations": report.get("violations", []),
            "timestamp": report.get("timestamp", ""),
            "reportedBy": report.get("reportedBy", ""),
            "reportedByName": report.get("reportedByName", reporter["name"] if reporter else "Unknown"),
            "reportedByRole": reporter["role"] if reporter else "Unknown",
            "status": report.get("status", "Pending Review"),
            "resolved": report.get("resolved", False),
            "resolution": report.get("resolution", ""),
            "resolvedAt": report.get("resolvedAt", ""),
            "resolvedBy": report.get("resolvedBy", ""),
            "resolvedByName": resolver["name"] if resolver else report.get("resolvedByName", "Unknown"),
            "location": report.get("location", "Unknown Location"),
            "description": report.get("description", ""),
            "severity": report.get("severity", "medium"),
            "photos": report.get("photos", []),
            "actionTaken": report.get("actionTaken", ""),
            "followUpRequired": report.get("followUpRequired", False),
            "followUpDate": report.get("followUpDate", ""),
            "workerSafetyHistory": worker_safety_history
        }
        
        return jsonify(enriched_report), 200
        
    except Exception as e:
        current_app.logger.error(f"Safety report fetch error: {str(e)}")
        return jsonify({"error": "Failed to fetch safety report"}), 500

@safety_reports_bp.route("/safety-reports/<report_id>", methods=["PUT"])
def update_safety_report(report_id):
    safety_col = current_app.config["SAFETY_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        data = request.json
        
        # Validate report ID
        if not ObjectId.is_valid(report_id):
            return jsonify({"error": "Invalid report ID"}), 400
        
        # Check if report exists
        report = safety_col.find_one({"_id": ObjectId(report_id)})
        if not report:
            return jsonify({"error": "Safety report not found"}), 404
        
        # Prepare update data
        update_data = {}
        
        if "status" in data:
            update_data["status"] = data["status"]
        
        if "resolution" in data:
            update_data["resolution"] = data["resolution"]
        
        if "resolved" in data:
            update_data["resolved"] = data["resolved"]
            if data["resolved"]:
                update_data["resolvedAt"] = datetime.now().isoformat()
                update_data["resolvedBy"] = decoded.get("email", "")
                # Get resolver name
                resolver = users_col.find_one({"email": decoded.get("email", "")})
                if resolver:
                    update_data["resolvedByName"] = resolver["name"]
        
        if "actionTaken" in data:
            update_data["actionTaken"] = data["actionTaken"]
        
        if "followUpRequired" in data:
            update_data["followUpRequired"] = data["followUpRequired"]
        
        if "followUpDate" in data:
            update_data["followUpDate"] = data["followUpDate"]
        
        if "severity" in data:
            update_data["severity"] = data["severity"]
        
        # Update the safety report
        result = safety_col.update_one(
            {"_id": ObjectId(report_id)}, 
            {"$set": update_data}
        )
        
        if result.modified_count:
            # Get updated report
            updated_report = safety_col.find_one({"_id": ObjectId(report_id)})
            
            # Get worker details
            worker = None
            if is_valid_objectid(updated_report.get("workerId", "")):
                worker = users_col.find_one({"_id": ObjectId(updated_report["workerId"])})
            
            # Get reporter details
            reporter = None
            if updated_report.get("reportedBy"):
                reporter = users_col.find_one({"email": updated_report["reportedBy"]})
            
            enriched_report = {
                "_id": str(updated_report["_id"]),
                "workerId": updated_report.get("workerId", ""),
                "workerName": updated_report.get("workerName", worker["name"] if worker else "Unknown Worker"),
                "helmet": updated_report.get("helmet", False),
                "vest": updated_report.get("vest", False),
                "violations": updated_report.get("violations", []),
                "timestamp": updated_report.get("timestamp", ""),
                "reportedBy": updated_report.get("reportedBy", ""),
                "reportedByName": updated_report.get("reportedByName", reporter["name"] if reporter else "Unknown"),
                "status": updated_report.get("status", "Pending Review"),
                "resolved": updated_report.get("resolved", False),
                "resolution": updated_report.get("resolution", ""),
                "resolvedAt": updated_report.get("resolvedAt", ""),
                "location": updated_report.get("location", "Unknown Location"),
                "description": updated_report.get("description", ""),
                "severity": updated_report.get("severity", "medium")
            }
            
            return jsonify({
                "message": "Safety report updated successfully",
                "report": enriched_report
            }), 200
        else:
            return jsonify({"error": "Report not found or no changes made"}), 404
            
    except Exception as e:
        current_app.logger.error(f"Safety report update error: {str(e)}")
        return jsonify({"error": "Failed to update safety report"}), 500

@safety_reports_bp.route("/safety-reports/stats", methods=["GET"])
def safety_reports_stats():
    safety_col = current_app.config["SAFETY_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get date range from query parameters (default to last 30 days)
        days = int(request.args.get('days', 30))
        start_date = (datetime.now() - timedelta(days=days)).date()
        end_date = datetime.now().date()
        
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())
        
        # Calculate statistics
        total_reports = safety_col.count_documents({})
        
        # Reports in date range
        recent_reports = safety_col.count_documents({
            "timestamp": {
                "$gte": start_datetime.isoformat(),
                "$lte": end_datetime.isoformat()
            }
        })
        
        unresolved_reports = safety_col.count_documents({"resolved": False})
        resolved_reports = safety_col.count_documents({"resolved": True})
        
        # Count by violation type
        helmet_violations = safety_col.count_documents({"helmet": False})
        vest_violations = safety_col.count_documents({"vest": False})
        
        # Count by status
        pending_reviews = safety_col.count_documents({"status": "Pending Review"})
        in_progress_reports = safety_col.count_documents({"status": "In Progress"})
        resolved_status_reports = safety_col.count_documents({"status": "Resolved"})
        
        # Count by severity
        low_severity = safety_col.count_documents({"severity": "low"})
        medium_severity = safety_col.count_documents({"severity": "medium"})
        high_severity = safety_col.count_documents({"severity": "high"})
        critical_severity = safety_col.count_documents({"severity": "critical"})
        
        # Weekly trends (last 4 weeks)
        weekly_trends = []
        for i in range(4):
            week_start = (datetime.now() - timedelta(weeks=i+1)).date()
            week_end = (datetime.now() - timedelta(weeks=i)).date()
            
            week_start_dt = datetime.combine(week_start, datetime.min.time())
            week_end_dt = datetime.combine(week_end, datetime.max.time())
            
            week_count = safety_col.count_documents({
                "timestamp": {
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
            "totalReports": total_reports,
            "recentReports": recent_reports,
            "unresolvedReports": unresolved_reports,
            "resolvedReports": resolved_reports,
            "violationTypes": {
                "helmet": helmet_violations,
                "vest": vest_violations,
                "both": safety_col.count_documents({"helmet": False, "vest": False})
            },
            "statusBreakdown": {
                "pending": pending_reviews,
                "inProgress": in_progress_reports,
                "resolved": resolved_status_reports
            },
            "severityBreakdown": {
                "low": low_severity,
                "medium": medium_severity,
                "high": high_severity,
                "critical": critical_severity
            },
            "weeklyTrends": weekly_trends,
            "timeRange": {
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
                "days": days
            },
            "resolutionRate": (resolved_reports / total_reports * 100) if total_reports > 0 else 0
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Safety reports stats error: {str(e)}")
        return jsonify({"error": "Failed to fetch safety reports statistics"}), 500

@safety_reports_bp.route("/safety-reports/workers", methods=["GET"])
def get_workers_with_violations():
    safety_col = current_app.config["SAFETY_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get workers with safety violations
        pipeline = [
            {
                "$match": {
                    "resolved": False  # Only unresolved violations
                }
            },
            {
                "$group": {
                    "_id": "$workerId",
                    "violationCount": {"$sum": 1},
                    "latestViolation": {"$max": "$timestamp"},
                    "workerName": {"$first": "$workerName"},
                    "violations": {"$push": "$violations"}
                }
            },
            {
                "$sort": {"violationCount": -1}
            }
        ]
        
        workers_with_violations = list(safety_col.aggregate(pipeline))
        
        # Enrich with worker details
        enriched_workers = []
        for worker in workers_with_violations:
            worker_details = None
            if is_valid_objectid(worker["_id"]):
                worker_details = users_col.find_one({"_id": ObjectId(worker["_id"])})
            
            # Flatten violations list
            all_violations = []
            for violation_list in worker["violations"]:
                all_violations.extend(violation_list)
            
            # Count violation types
            violation_counts = {}
            for violation in all_violations:
                violation_counts[violation] = violation_counts.get(violation, 0) + 1
            
            enriched_workers.append({
                "workerId": worker["_id"],
                "workerName": worker["workerName"],
                "workerDetails": {
                    "position": worker_details.get("position", "Worker") if worker_details else "Unknown",
                    "team": worker_details.get("team", "No team assigned") if worker_details else "Unknown",
                    "status": worker_details.get("status", "active") if worker_details else "Unknown"
                },
                "violationCount": worker["violationCount"],
                "latestViolation": worker["latestViolation"],
                "violationTypes": violation_counts,
                "mostCommonViolation": max(violation_counts.items(), key=lambda x: x[1])[0] if violation_counts else "None"
            })
        
        return jsonify(enriched_workers), 200
        
    except Exception as e:
        current_app.logger.error(f"Workers with violations fetch error: {str(e)}")
        return jsonify({"error": "Failed to fetch workers with violations"}), 500