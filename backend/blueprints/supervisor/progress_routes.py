# progress_routes.py
from flask import Blueprint, request, jsonify, current_app
import jwt
import datetime
from bson import ObjectId
from datetime import datetime, timedelta
import re

# Blueprint instance
progress_bp = Blueprint("progress", __name__)

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

# ---------------- PROGRESS REPORTS ----------------
@progress_bp.route("/progress/reports", methods=["GET"])
def get_progress_reports():
    tasks_col = current_app.config["TASKS_COLLECTION"]
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get query parameters
        start_date = request.args.get('startDate')
        end_date = request.args.get('endDate')
        project = request.args.get('project')
        
        # Build date filter
        date_filter = {}
        if start_date and end_date:
            date_filter = {"date": {"$gte": start_date, "$lte": end_date}}
        elif start_date:
            date_filter = {"date": {"$gte": start_date}}
        elif end_date:
            date_filter = {"date": {"$lte": end_date}}
        
        # Get all workers
        workers = list(users_col.find({"role": "Worker"}, {"_id": 1, "name": 1, "email": 1}))
        
        # Get tasks data
        tasks = list(tasks_col.find({}))
        
        # Get attendance data
        attendance = list(attendance_col.find(date_filter))
        
        # Calculate statistics
        report_data = generate_progress_report(workers, tasks, attendance, start_date, end_date)
        
        return jsonify(report_data), 200
        
    except Exception as e:
        current_app.logger.error(f"Progress reports error: {str(e)}")
        return jsonify({"error": "Failed to generate progress reports"}), 500

@progress_bp.route("/progress/summary", methods=["GET"])
def get_progress_summary():
    tasks_col = current_app.config["TASKS_COLLECTION"]
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get date range (default: last 30 days)
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=30)
        
        # Get tasks summary
        tasks_summary = {
            "total": tasks_col.count_documents({}),
            "completed": tasks_col.count_documents({"status": {"$in": ["Completed", "Approved"]}}),
            "in_progress": tasks_col.count_documents({"status": "In Progress"}),
            "pending": tasks_col.count_documents({"status": "Pending"}),
            "overdue": tasks_col.count_documents({
                "deadline": {"$lt": end_date.isoformat()},
                "status": {"$nin": ["Completed", "Approved"]}
            })
        }
        
        # Get attendance summary
        attendance_summary = {
            "total_days": attendance_col.count_documents({
                "date": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
            }),
            "present": attendance_col.count_documents({
                "date": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()},
                "status": "Present"
            }),
            "absent": attendance_col.count_documents({
                "date": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()},
                "status": "Absent"
            }),
            "late": attendance_col.count_documents({
                "date": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()},
                "status": "Late"
            })
        }
        
        # Calculate productivity metrics
        completed_tasks = tasks_col.find({
            "status": {"$in": ["Completed", "Approved"]},
            "completedAt": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
        })
        
        total_completed = completed_tasks.count()
        avg_completion_time = calculate_average_completion_time(completed_tasks)
        
        summary = {
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "tasks": tasks_summary,
            "attendance": attendance_summary,
            "productivity": {
                "tasks_completed": total_completed,
                "avg_completion_days": avg_completion_time,
                "completion_rate": (total_completed / tasks_summary["total"] * 100) if tasks_summary["total"] > 0 else 0
            }
        }
        
        return jsonify(summary), 200
        
    except Exception as e:
        current_app.logger.error(f"Progress summary error: {str(e)}")
        return jsonify({"error": "Failed to generate progress summary"}), 500

@progress_bp.route("/progress/export", methods=["GET"])
def export_progress_report():
    tasks_col = current_app.config["TASKS_COLLECTION"]
    attendance_col = current_app.config["ATTENDANCE_COLLECTION"]
    users_col = current_app.config["USERS_COLLECTION"]
    
    try:
        decoded, error_response, status_code = verify_token()
        if error_response:
            return error_response, status_code
        
        # Get query parameters
        start_date = request.args.get('startDate')
        end_date = request.args.get('endDate')
        report_type = request.args.get('type', 'csv')
        
        # Generate report data
        workers = list(users_col.find({"role": "Worker"}))
        tasks = list(tasks_col.find({}))
        attendance = list(attendance_col.find({
            "date": {"$gte": start_date, "$lte": end_date}
        })) if start_date and end_date else list(attendance_col.find({}))
        
        report_data = generate_export_data(workers, tasks, attendance, report_type)
        
        return jsonify({
            "data": report_data,
            "format": report_type,
            "generated_at": datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Export progress error: {str(e)}")
        return jsonify({"error": "Failed to export progress report"}), 500

# Helper functions
def generate_progress_report(workers, tasks, attendance, start_date, end_date):
    """Generate comprehensive progress report"""
    
    # Worker performance analysis
    worker_performance = []
    for worker in workers:
        worker_id = str(worker["_id"])
        
        # Tasks assigned to this worker
        worker_tasks = [t for t in tasks if t.get("assignedTo") == worker_id or t.get("assignedTo") == worker.get("email")]
        completed_tasks = [t for t in worker_tasks if t.get("status") in ["Completed", "Approved"]]
        
        # Attendance for this worker
        worker_attendance = [a for a in attendance if a.get("workerId") == worker_id]
        present_days = len([a for a in worker_attendance if a.get("status") == "Present"])
        
        worker_performance.append({
            "worker_id": worker_id,
            "worker_name": worker.get("name", "Unknown"),
            "tasks_assigned": len(worker_tasks),
            "tasks_completed": len(completed_tasks),
            "completion_rate": (len(completed_tasks) / len(worker_tasks) * 100) if len(worker_tasks) > 0 else 0,
            "attendance_days": present_days,
            "performance_score": calculate_performance_score(worker_tasks, worker_attendance)
        })
    
    # Project progress analysis
    task_status_count = {
        "total": len(tasks),
        "completed": len([t for t in tasks if t.get("status") in ["Completed", "Approved"]]),
        "in_progress": len([t for t in tasks if t.get("status") == "In Progress"]),
        "pending": len([t for t in tasks if t.get("status") == "Pending"]),
        "overdue": len([t for t in tasks if 
            t.get("deadline") and 
            datetime.strptime(t["deadline"], "%Y-%m-%d").date() < datetime.now().date() and
            t.get("status") not in ["Completed", "Approved"]
        ])
    }
    
    # Attendance summary
    attendance_summary = {
        "total_records": len(attendance),
        "present": len([a for a in attendance if a.get("status") == "Present"]),
        "absent": len([a for a in attendance if a.get("status") == "Absent"]),
        "late": len([a for a in attendance if a.get("status") == "Late"]),
        "leave": len([a for a in attendance if a.get("status") == "Leave"]),
        "attendance_rate": (len([a for a in attendance if a.get("status") == "Present"]) / len(attendance) * 100) if len(attendance) > 0 else 0
    }
    
    return {
        "date_range": {
            "start": start_date,
            "end": end_date
        },
        "worker_performance": worker_performance,
        "task_summary": task_status_count,
        "attendance_summary": attendance_summary,
        "generated_at": datetime.now().isoformat()
    }

def calculate_performance_score(tasks, attendance):
    """Calculate worker performance score"""
    if not tasks:
        return 0
    
    completed_tasks = len([t for t in tasks if t.get("status") in ["Completed", "Approved"]])
    task_score = (completed_tasks / len(tasks)) * 50
    
    if attendance:
        present_days = len([a for a in attendance if a.get("status") == "Present"])
        attendance_score = (present_days / len(attendance)) * 50
    else:
        attendance_score = 0
    
    return round(task_score + attendance_score, 2)

def calculate_average_completion_time(completed_tasks):
    """Calculate average task completion time in days"""
    total_days = 0
    count = 0
    
    for task in completed_tasks:
        if task.get("createdAt") and task.get("completedAt"):
            try:
                created_date = datetime.fromisoformat(task["createdAt"].replace('Z', '+00:00'))
                completed_date = datetime.fromisoformat(task["completedAt"].replace('Z', '+00:00'))
                days_taken = (completed_date - created_date).days
                total_days += max(1, days_taken)  # At least 1 day
                count += 1
            except:
                continue
    
    return round(total_days / count, 2) if count > 0 else 0

def generate_export_data(workers, tasks, attendance, format_type):
    """Generate data for export in various formats"""
    
    if format_type == "csv":
        # Generate CSV-like structure
        return {
            "workers": len(workers),
            "tasks": len(tasks),
            "attendance_records": len(attendance),
            "export_format": "csv",
            "data_available": True
        }
    else:
        # Default JSON structure
        return {
            "workers": workers,
            "tasks": tasks,
            "attendance": attendance,
            "export_format": "json"
        }