# notifications.py
from flask_socketio import SocketIO, emit
import datetime

socketio = SocketIO()

def send_alert_notification(alert_data):
    """Send real-time alert notification to connected supervisors"""
    socketio.emit('new_alert', {
        'alert': alert_data,
        'timestamp': datetime.datetime.now().isoformat(),
        'message': 'New alert requires attention'
    }, namespace='/alerts')

def send_alert_update_notification(alert_id, update_data):
    """Send alert update notification"""
    socketio.emit('alert_update', {
        'alertId': alert_id,
        'updates': update_data,
        'timestamp': datetime.datetime.now().isoformat()
    }, namespace='/alerts')