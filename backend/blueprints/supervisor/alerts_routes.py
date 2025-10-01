# alerts_routes.py
from flask import Blueprint, request, jsonify, current_app
import jwt
import datetime
from bson import ObjectId
from datetime import datetime, timedelta
import re

# Blueprint instance
alerts_bp = Blueprint("alerts", __name__)

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

# ---------------- ALERTS MANAGEMENT ----------------
@alerts_bp.route("/alerts", methods=["GET"])
def get_alerts():
    safety_col = current_app.config["SAFETY_COLLECTION"]
    emergency_col = current_app.config["EMERGENCY_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get query parameters for filtering
        status_filter = request.args.get('status', 'all')
        type_filter = request.args.get('type', 'all')
        priority_filter = request.args.get('priority', 'all')
        
        # Get unresolved safety violations
        safety_query = {"resolved": False}
        if status_filter != 'all':
            safety_query["status"] = status_filter.title()
        
        safety_alerts = list(safety_col.find(safety_query))
        
        # Get unresolved emergencies
        emergency_query = {"resolved": False}
        if status_filter != 'all':
            emergency_query["status"] = status_filter.title()
        if priority_filter != 'all':
            emergency_query["priority"] = priority_filter.title()
        
        emergency_alerts = list(emergency_col.find(emergency_query))
        
        # Transform safety violations to alert format
        formatted_safety_alerts = []
        for alert in safety_alerts:
            # Get reporter info
            reporter = None
            if is_valid_objectid(alert.get("reportedBy", "")):
                reporter = users_col.find_one({"_id": ObjectId(alert["reportedBy"])})
            
            # Get worker info
            worker = None
            if is_valid_objectid(alert.get("workerId", "")):
                worker = users_col.find_one({"_id": ObjectId(alert["workerId"])})
            
            formatted_safety_alerts.append({
                "_id": f"safety-{str(alert['_id'])}",
                "type": "safety",
                "title": "Safety Violation",
                "description": f"Worker {alert.get('workerName', 'Unknown')} violated safety protocols: {', '.join(alert.get('violations', []))}",
                "priority": "high" if len(alert.get('violations', [])) > 1 else "medium",
                "status": alert.get("status", "Pending Review").lower().replace(" ", "-"),
                "location": alert.get("location", "Unknown Location"),
                "reportedBy": alert.get("reportedBy", ""),
                "reportedByName": reporter["name"] if reporter else alert.get("reportedByName", "Unknown"),
                "timestamp": alert.get("timestamp", ""),
                "assignedTo": alert.get("assignedTo", ""),
                "assignedToName": alert.get("assignedToName", ""),
                "originalId": str(alert["_id"]),
                "originalType": "safety"
            })
        
        # Transform emergencies to alert format
        formatted_emergency_alerts = []
        for alert in emergency_alerts:
            # Get reporter info
            reporter = None
            if is_valid_objectid(alert.get("reportedBy", "")):
                reporter = users_col.find_one({"_id": ObjectId(alert["reportedBy"])})
            
            # Get assigned to info
            assigned_to = None
            if is_valid_objectid(alert.get("assignedTo", "")):
                assigned_to = users_col.find_one({"_id": ObjectId(alert["assignedTo"])})
            
            formatted_emergency_alerts.append({
                "_id": f"emergency-{str(alert['_id'])}",
                "type": "emergency",
                "title": f"{alert.get('type', 'Emergency')} Alert",
                "description": alert.get("description", f"{alert.get('type', 'Emergency')} reported at {alert.get('location', 'unknown location')}"),
                "priority": alert.get("priority", "medium").lower(),
                "status": alert.get("status", "Open").lower().replace(" ", "-"),
                "location": alert.get("location", "Unknown Location"),
                "reportedBy": alert.get("reportedBy", ""),
                "reportedByName": reporter["name"] if reporter else alert.get("reportedByName", "Unknown"),
                "timestamp": alert.get("timestamp", ""),
                "assignedTo": alert.get("assignedTo", ""),
                "assignedToName": assigned_to["name"] if assigned_to else alert.get("assignedToName", "Unassigned"),
                "originalId": str(alert["_id"]),
                "originalType": "emergency"
            })
        
        # Combine and sort alerts by timestamp (newest first)
        all_alerts = formatted_safety_alerts + formatted_emergency_alerts
        all_alerts.sort(key=lambda x: x["timestamp"], reverse=True)
        
        # Apply type filter
        if type_filter != 'all':
            all_alerts = [alert for alert in all_alerts if alert["type"] == type_filter]
        
        return jsonify(all_alerts), 200
        
    except Exception as e:
        current_app.logger.error(f"Alerts fetch error: {str(e)}")
        return jsonify({"error": "Failed to fetch alerts data"}), 500

# ---------------- ALERT ACTIONS ----------------
@alerts_bp.route("/alerts/<alert_id>", methods=["PUT"])
def update_alert(alert_id):
    safety_col = current_app.config["SAFETY_COLLECTION"]
    emergency_col = current_app.config["EMERGENCY_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        data = request.json
        
        # Parse alert ID to determine type
        if alert_id.startswith("safety-"):
            original_id = alert_id.replace("safety-", "")
            collection = safety_col
        elif alert_id.startswith("emergency-"):
            original_id = alert_id.replace("emergency-", "")
            collection = emergency_col
        else:
            return jsonify({"error": "Invalid alert ID format"}), 400
        
        # Validate alert exists
        if not ObjectId.is_valid(original_id):
            return jsonify({"error": "Invalid alert ID"}), 400
            
        alert = collection.find_one({"_id": ObjectId(original_id)})
        if not alert:
            return jsonify({"error": "Alert not found"}), 404
        
        # Prepare update data
        update_data = {}
        if "status" in data:
            update_data["status"] = data["status"].title()
        if "assignedTo" in data:
            update_data["assignedTo"] = data["assignedTo"]
            # Resolve assigned to name
            if data["assignedTo"] and is_valid_objectid(data["assignedTo"]):
                assigned_user = users_col.find_one({"_id": ObjectId(data["assignedTo"])})
                if assigned_user:
                    update_data["assignedToName"] = assigned_user["name"]
        if "resolution" in data:
            update_data["resolution"] = data["resolution"]
        if "resolved" in data:
            update_data["resolved"] = data["resolved"]
            if data["resolved"]:
                update_data["resolvedAt"] = datetime.now().isoformat()
        
        # Update the alert
        result = collection.update_one(
            {"_id": ObjectId(original_id)}, 
            {"$set": update_data}
        )
        
        if result.modified_count:
            # Return updated alert
            updated_alert = collection.find_one({"_id": ObjectId(original_id)})
            
            # Transform to alert format
            if alert_id.startswith("safety-"):
                alert_type = "safety"
                title = "Safety Violation"
                description = f"Worker {updated_alert.get('workerName', 'Unknown')} violated safety protocols: {', '.join(updated_alert.get('violations', []))}"
                priority = "high" if len(updated_alert.get('violations', [])) > 1 else "medium"
            else:
                alert_type = "emergency"
                title = f"{updated_alert.get('type', 'Emergency')} Alert"
                description = updated_alert.get("description", f"{updated_alert.get('type', 'Emergency')} reported at {updated_alert.get('location', 'unknown location')}")
                priority = updated_alert.get("priority", "medium").lower()
            
            # Get reporter info
            reporter = None
            if is_valid_objectid(updated_alert.get("reportedBy", "")):
                reporter = users_col.find_one({"_id": ObjectId(updated_alert["reportedBy"])})
            
            # Get assigned to info
            assigned_to = None
            if is_valid_objectid(updated_alert.get("assignedTo", "")):
                assigned_to = users_col.find_one({"_id": ObjectId(updated_alert["assignedTo"])})
            
            formatted_alert = {
                "_id": alert_id,
                "type": alert_type,
                "title": title,
                "description": description,
                "priority": priority,
                "status": updated_alert.get("status", "Open").lower().replace(" ", "-"),
                "location": updated_alert.get("location", "Unknown Location"),
                "reportedBy": updated_alert.get("reportedBy", ""),
                "reportedByName": reporter["name"] if reporter else updated_alert.get("reportedByName", "Unknown"),
                "timestamp": updated_alert.get("timestamp", ""),
                "assignedTo": updated_alert.get("assignedTo", ""),
                "assignedToName": assigned_to["name"] if assigned_to else updated_alert.get("assignedToName", "Unassigned"),
                "resolution": updated_alert.get("resolution", ""),
                "resolved": updated_alert.get("resolved", False),
                "resolvedAt": updated_alert.get("resolvedAt", "")
            }
            
            return jsonify({
                "message": "Alert updated successfully",
                "alert": formatted_alert
            }), 200
        else:
            return jsonify({"error": "Alert not found or no changes made"}), 404
            
    except Exception as e:
        current_app.logger.error(f"Alert update error: {str(e)}")
        return jsonify({"error": "Failed to update alert"}), 500

# ---------------- ALERT STATS ----------------
@alerts_bp.route("/alerts/stats", methods=["GET"])
def alert_stats():
    safety_col = current_app.config["SAFETY_COLLECTION"]
    emergency_col = current_app.config["EMERGENCY_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get today's date for filtering
        today = datetime.now().date()
        today_start = datetime(today.year, today.month, today.day)
        today_end = datetime(today.year, today.month, today.day, 23, 59, 59)
        
        # Calculate statistics for safety alerts
        total_safety = safety_col.count_documents({"resolved": False})
        today_safety = safety_col.count_documents({
            "timestamp": {
                "$gte": today_start.isoformat(),
                "$lte": today_end.isoformat()
            },
            "resolved": False
        })
        
        # Calculate statistics for emergency alerts
        total_emergency = emergency_col.count_documents({"resolved": False})
        today_emergency = emergency_col.count_documents({
            "timestamp": {
                "$gte": today_start.isoformat(),
                "$lte": today_end.isoformat()
            },
            "resolved": False
        })
        
        # Count critical emergencies
        critical_emergencies = emergency_col.count_documents({
            "priority": "Critical",
            "resolved": False
        })
        
        # Count resolved today
        resolved_today = emergency_col.count_documents({
            "resolvedAt": {
                "$gte": today_start.isoformat(),
                "$lte": today_end.isoformat()
            },
            "resolved": True
        }) + safety_col.count_documents({
            "resolvedAt": {
                "$gte": today_start.isoformat(),
                "$lte": today_end.isoformat()
            },
            "resolved": True
        })
        
        return jsonify({
            "totalAlerts": total_safety + total_emergency,
            "pendingAlerts": total_safety + total_emergency,  # All are pending resolution
            "criticalAlerts": critical_emergencies,
            "resolvedToday": resolved_today,
            "safetyAlerts": total_safety,
            "emergencyAlerts": total_emergency,
            "todayAlerts": today_safety + today_emergency
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Alert stats error: {str(e)}")
        return jsonify({"error": "Failed to fetch alert statistics"}), 500

# ---------------- BULK ALERT ACTIONS ----------------
@alerts_bp.route("/alerts/bulk", methods=["POST"])
def bulk_alert_actions():
    safety_col = current_app.config["SAFETY_COLLECTION"]
    emergency_col = current_app.config["EMERGENCY_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        data = request.json
        alert_ids = data.get("alertIds", [])
        action = data.get("action", "")
        
        if not alert_ids or not action:
            return jsonify({"error": "Missing alert IDs or action"}), 400
        
        results = {
            "successful": 0,
            "failed": 0,
            "details": []
        }
        
        for alert_id in alert_ids:
            try:
                # Parse alert ID to determine type
                if alert_id.startswith("safety-"):
                    original_id = alert_id.replace("safety-", "")
                    collection = safety_col
                elif alert_id.startswith("emergency-"):
                    original_id = alert_id.replace("emergency-", "")
                    collection = emergency_col
                else:
                    results["failed"] += 1
                    results["details"].append({"alertId": alert_id, "error": "Invalid alert ID format"})
                    continue
                
                # Validate alert exists
                if not ObjectId.is_valid(original_id):
                    results["failed"] += 1
                    results["details"].append({"alertId": alert_id, "error": "Invalid alert ID"})
                    continue
                
                # Prepare update based on action
                update_data = {}
                if action == "acknowledge":
                    update_data["status"] = "In Progress"
                elif action == "resolve":
                    update_data["status"] = "Resolved"
                    update_data["resolved"] = True
                    update_data["resolvedAt"] = datetime.now().isoformat()
                    update_data["resolution"] = "Bulk resolution by supervisor"
                elif action == "assign-to-me":
                    update_data["assignedTo"] = decoded.get("email", "")
                    update_data["assignedToName"] = decoded.get("name", "Current User")
                    update_data["status"] = "In Progress"
                else:
                    results["failed"] += 1
                    results["details"].append({"alertId": alert_id, "error": "Invalid action"})
                    continue
                
                # Update the alert
                result = collection.update_one(
                    {"_id": ObjectId(original_id)}, 
                    {"$set": update_data}
                )
                
                if result.modified_count:
                    results["successful"] += 1
                    results["details"].append({"alertId": alert_id, "status": "success"})
                else:
                    results["failed"] += 1
                    results["details"].append({"alertId": alert_id, "error": "Alert not found or no changes made"})
                    
            except Exception as e:
                results["failed"] += 1
                results["details"].append({"alertId": alert_id, "error": str(e)})
        
        return jsonify({
            "message": f"Bulk action completed: {results['successful']} successful, {results['failed']} failed",
            "results": results
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Bulk alert action error: {str(e)}")
        return jsonify({"error": "Failed to perform bulk action"}), 500