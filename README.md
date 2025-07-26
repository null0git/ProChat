# ProChat - Professional Real-Time Chat Application

A full-featured real-time chat application built with Flask and WebSocket technology, designed for local network deployment with professional messaging capabilities.

## Features

- **Real-time Messaging**: Instant messaging powered by WebSocket technology
- **Local Authentication**: Username/password authentication system (no internet required)
- **Group Chats**: Create and manage group conversations
- **Stories**: Share 24-hour expiring stories with images and videos
- **User Profiles**: Complete profile management with avatars and bio
- **Smart Search**: Find users by username, phone number, or name
- **Privacy Controls**: Granular privacy settings for profile visibility
- **Admin Panel**: Administrative interface for user and platform management
- **Professional UI**: Modern, responsive design with dark mode support
- **File Sharing**: Upload and share images, documents, audio, and video files

## Installation Guide

### Prerequisites

- Python 3.11 or higher
- PostgreSQL database
- Git

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/prochat.git
cd prochat
```

### Step 2: Set Up Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

Create a `requirements.txt` file with these dependencies:
```
Flask==3.0.0
Flask-SQLAlchemy==3.1.1
Flask-Login==0.6.3
Flask-SocketIO==5.3.6
gunicorn==21.2.0
psycopg2-binary==2.9.9
python-socketio==5.11.0
Werkzeug==3.0.1
eventlet==0.33.3
```

### Step 4: Set Up PostgreSQL Database

1. Install PostgreSQL on your system
2. Create a new database:
   ```sql
   CREATE DATABASE prochat;
   CREATE USER prochat_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE prochat TO prochat_user;
   ```

### Step 5: Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Database Configuration
DATABASE_URL=postgresql://prochat_user:your_password@localhost:5432/prochat

# Session Secret (generate a random string)
SESSION_SECRET=your-super-secret-key-here-make-it-long-and-random

# Flask Environment
FLASK_ENV=development
FLASK_DEBUG=True
```

### Step 6: Initialize Database

The application will automatically create all necessary tables when you first run it.

### Step 7: Run the Application

```bash
# Development mode
python main.py

# Production mode with Gunicorn
gunicorn --bind 0.0.0.0:5000 --reuse-port --reload main:app
```

### Step 8: Access the Application

Open your web browser and navigate to:
- `http://localhost:5000` (if running locally)
- `http://your-server-ip:5000` (if running on a server)

## First Setup

1. **Create Admin Account**: The first user to register will automatically become an administrator
2. **Configure Settings**: Access the admin panel to configure platform settings
3. **Add Users**: Users can register themselves or be added through the admin panel

## Configuration

### File Upload Settings

The application supports file uploads with the following limits:
- Maximum file size: 16MB
- Supported image formats: PNG, JPG, JPEG, GIF, WebP
- Supported document formats: PDF, DOC, DOCX, TXT, RTF
- Supported video formats: MP4, AVI, MOV, WMV, WebM
- Supported audio formats: MP3, WAV, OGG, M4A

### Network Configuration

For local network deployment:

1. **Firewall**: Open port 5000 on your server
2. **Router**: Configure port forwarding if needed
3. **SSL**: Consider using a reverse proxy (nginx) for HTTPS in production

## Usage

### For Regular Users

1. **Registration**: Create an account with username, email, and password
2. **Profile Setup**: Add profile picture, bio, and contact information
3. **Start Chatting**: Send direct messages or create group chats
4. **Share Stories**: Upload images/videos that expire after 24 hours
5. **Privacy**: Configure who can see your information and activity

### For Administrators

1. **User Management**: View, edit, or suspend user accounts
2. **Group Management**: Monitor and manage group conversations
3. **Content Moderation**: Review reported content and user behavior
4. **Analytics**: View platform usage statistics and metrics

## Troubleshooting

### Common Issues

**Database Connection Error**
- Check if PostgreSQL is running
- Verify database credentials in `.env` file
- Ensure the database exists and user has proper permissions

**Port Already in Use**
- Kill existing processes: `sudo kill -9 $(sudo lsof -t -i:5000)`
- Use a different port: `python main.py --port 5001`

**File Upload Issues**
- Check file size limits (16MB max)
- Verify file format is supported
- Ensure uploads directory has write permissions

### Getting Help

For technical support or questions:
1. Check the console logs for error messages
2. Verify all environment variables are set correctly
3. Ensure all dependencies are installed
4. Check firewall and network connectivity

## Security Notes

- Change the default `SESSION_SECRET` to a strong, random value
- Use HTTPS in production environments
- Regularly update dependencies for security patches
- Monitor user activity through the admin panel
- Set up regular database backups

## Development

To contribute to the project:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Technical Architecture

- **Backend**: Flask with SQLAlchemy ORM
- **Real-time**: Flask-SocketIO with WebSocket support
- **Database**: PostgreSQL with connection pooling
- **Frontend**: Jinja2 templates with Bootstrap 5
- **Authentication**: Local username/password system
- **File Storage**: Local filesystem with secure uploads

---

**ProChat** - Professional messaging for local networks