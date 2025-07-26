import os
import uuid
from werkzeug.utils import secure_filename
from flask import current_app

ALLOWED_EXTENSIONS = {
    'image': {'png', 'jpg', 'jpeg', 'gif', 'webp'},
    'document': {'pdf', 'doc', 'docx', 'txt', 'rtf'},
    'video': {'mp4', 'avi', 'mov', 'wmv', 'webm'},
    'audio': {'mp3', 'wav', 'ogg', 'm4a'}
}

def allowed_file(filename, file_type='image'):
    """Check if the file extension is allowed for the given file type."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS.get(file_type, ALLOWED_EXTENSIONS['image'])

def save_uploaded_file(file, subfolder=''):
    """Save an uploaded file to the uploads directory."""
    if file and allowed_file(file.filename):
        # Generate unique filename
        filename = secure_filename(file.filename)
        name, ext = os.path.splitext(filename)
        unique_filename = f"{name}_{uuid.uuid4().hex[:8]}{ext}"
        
        # Create subfolder if it doesn't exist
        upload_path = current_app.config['UPLOAD_FOLDER']
        if subfolder:
            upload_path = os.path.join(upload_path, subfolder)
            os.makedirs(upload_path, exist_ok=True)
        
        # Save file
        file_path = os.path.join(upload_path, unique_filename)
        file.save(file_path)
        
        return unique_filename
    return None

def format_timestamp(timestamp):
    """Format timestamp for display."""
    from datetime import datetime, timedelta
    
    now = datetime.utcnow()
    diff = now - timestamp
    
    if diff.days > 7:
        return timestamp.strftime('%Y-%m-%d')
    elif diff.days > 0:
        return f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
    elif diff.seconds > 3600:
        hours = diff.seconds // 3600
        return f"{hours} hour{'s' if hours > 1 else ''} ago"
    elif diff.seconds > 60:
        minutes = diff.seconds // 60
        return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
    else:
        return "Just now"

def get_file_size_mb(file_path):
    """Get file size in MB."""
    try:
        size_bytes = os.path.getsize(file_path)
        return round(size_bytes / (1024 * 1024), 2)
    except:
        return 0

def truncate_text(text, max_length=50):
    """Truncate text to specified length."""
    if len(text) <= max_length:
        return text
    return text[:max_length].rstrip() + '...'
