from flask import Flask
from pymongo import MongoClient
from blueprints.logins import auth_bp
from blueprints.manager.manager import mang_bp
from blueprints.manager.safety_routes import safety_bp
from blueprints.manager.emergency import emergency_bp
from blueprints.supervisor.supertask import task_bp
from blueprints.user_routes import user_bp
from blueprints.supervisor.alerts_routes import alerts_bp 
from blueprints.supervisor.supervisor_routes import sup_bp 
from blueprints.supervisor.attendance_routes import attendance_bp   
from blueprints.supervisor.team_routes import team_bp   
from blueprints.supervisor.progress_routes import progress_bp   
from blueprints.supervisor.safety_reports_routes import safety_reports_bp   
from blueprints.supervisor.new_workers_routes import new_workers_bp   
from blueprints.chat import chat_bp

app = Flask(__name__)

# ✅ Must be a string
app.config["SECRET_KEY"] = "mysecretkey"

# MongoDB setup
client = MongoClient("mongodb://localhost:27017/")
db = client["construction_app"]
app.config["USERS_COLLECTION"] = db["users"]
app.config["TASKS_COLLECTION"] = db["tasks"]
app.config['ATTENDANCE_COLLECTION'] = db["attendance"]
app.config['SAFETY_COLLECTION'] = db["safety"]
app.config['EMERGENCY_COLLECTION'] = db["emergencies"]

# Register blueprint
app.register_blueprint(auth_bp, url_prefix="/api")
app.register_blueprint(mang_bp, url_prefix="/api")
app.register_blueprint(safety_bp, url_prefix="/api")
app.register_blueprint(emergency_bp, url_prefix="/api")
app.register_blueprint(task_bp, url_prefix="/api")
app.register_blueprint(user_bp, url_prefix="/api")
app.register_blueprint(alerts_bp , url_prefix="/api")
app.register_blueprint(sup_bp , url_prefix="/api")
app.register_blueprint(attendance_bp, url_prefix="/api")
app.register_blueprint(team_bp, url_prefix="/api")
app.register_blueprint(progress_bp, url_prefix="/api")
app.register_blueprint(safety_reports_bp, url_prefix="/api")
app.register_blueprint(new_workers_bp, url_prefix="/api")
app.register_blueprint(chat_bp, url_prefix="/api")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
