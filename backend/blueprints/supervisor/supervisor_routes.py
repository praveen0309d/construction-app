# supervisor_routes.py (if you have a separate supervisor blueprint)
from flask import Blueprint, request, jsonify, current_app

sup_bp = Blueprint("supervisor", __name__)

@sup_bp.route("/supervisor/alerts/assigned", methods=["GET"])
def get_assigned_alerts():
    safety_col = current_app.config["SAFETY_COLLECTION"]
    emergency_col = current_app.config["EMERGENCY_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get alerts assigned to current supervisor
        supervisor_email = decoded.get("email", "")
        
        # Get assigned safety alerts
        safety_alerts = list(safety_col.find({
            "assignedTo": supervisor_email,
            "resolved": False
        }))
        
        # Get assigned emergency alerts
        emergency_alerts = list(emergency_col.find({
            "assignedTo": supervisor_email,
            "resolved": False
        }))
        
        # Format the response (similar to alerts_routes.py format)
        formatted_alerts = []
        # ... formatting logic here ...
        
        return jsonify(formatted_alerts), 200
        
    except Exception as e:
        current_app.logger.error(f"Assigned alerts fetch error: {str(e)}")
        return jsonify({"error": "Failed to fetch assigned alerts"}), 500