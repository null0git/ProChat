from datetime import datetime, timedelta
from app import db
from flask_login import UserMixin
from sqlalchemy import UniqueConstraint, func
from werkzeug.security import generate_password_hash, check_password_hash

# User model for local authentication
class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    first_name = db.Column(db.String(64), nullable=True)
    last_name = db.Column(db.String(64), nullable=True)
    profile_image_url = db.Column(db.String(255), nullable=True)
    
    # Additional chat app fields
    phone_number = db.Column(db.String(20), unique=True, nullable=True)
    bio = db.Column(db.Text, nullable=True)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    is_online = db.Column(db.Boolean, default=False)
    is_admin = db.Column(db.Boolean, default=False)
    
    # Privacy settings
    show_last_seen = db.Column(db.String(20), default='everyone')  # everyone, contacts, nobody
    show_phone = db.Column(db.String(20), default='contacts')
    show_bio = db.Column(db.String(20), default='everyone')
    read_receipts = db.Column(db.Boolean, default=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    sent_messages = db.relationship('Message', foreign_keys='Message.sender_id', backref='sender', lazy='dynamic')
    group_memberships = db.relationship('GroupMembership', backref='user', lazy='dynamic')
    stories = db.relationship('Story', backref='author', lazy='dynamic')
    blocked_users = db.relationship('BlockedUser', foreign_keys='BlockedUser.blocker_id', backref='blocker', lazy='dynamic')
    
    def get_display_name(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        elif self.first_name:
            return self.first_name
        elif self.username:
            return self.username
        return self.email or str(self.id)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Group(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    group_image_url = db.Column(db.String(255))
    is_premium = db.Column(db.Boolean, default=False)
    premium_price = db.Column(db.Float, default=0.0)
    max_members = db.Column(db.Integer, default=100)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    memberships = db.relationship('GroupMembership', backref='group', lazy='dynamic', cascade='all, delete-orphan')
    messages = db.relationship('Message', backref='group', lazy='dynamic')
    
class GroupMembership(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=False)
    role = db.Column(db.String(20), default='member')  # admin, moderator, member
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_paid = db.Column(db.Boolean, default=False)
    payment_expires_at = db.Column(db.DateTime)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text)
    message_type = db.Column(db.String(20), default='text')  # text, image, document, voice
    file_url = db.Column(db.String(255))
    file_name = db.Column(db.String(255))
    
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('users.id'))  # For direct messages
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'))  # For group messages
    
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    is_edited = db.Column(db.Boolean, default=False)
    edited_at = db.Column(db.DateTime)
    
    # Message status
    delivered_at = db.Column(db.DateTime)
    read_at = db.Column(db.DateTime)
    
class Story(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text)
    media_url = db.Column(db.String(255))
    media_type = db.Column(db.String(20))  # image, video
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, default=lambda: datetime.utcnow() + timedelta(hours=24))
    
    # Privacy settings
    visibility = db.Column(db.String(20), default='everyone')  # everyone, contacts, nobody
    
    # Relationships
    views = db.relationship('StoryView', backref='story', lazy='dynamic', cascade='all, delete-orphan')
    
    @property
    def is_expired(self):
        return datetime.utcnow() > self.expires_at
    
    @property
    def view_count(self):
        return self.views.count()

class StoryView(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    story_id = db.Column(db.Integer, db.ForeignKey('story.id'), nullable=False)
    viewer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    viewed_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (UniqueConstraint('story_id', 'viewer_id'),)

class Contact(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    contact_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (UniqueConstraint('user_id', 'contact_id'),)

class BlockedUser(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    blocker_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    blocked_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    blocked_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (UniqueConstraint('blocker_id', 'blocked_id'),)

class UserSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    session_id = db.Column(db.String(255), nullable=False)
    device_info = db.Column(db.String(255))
    ip_address = db.Column(db.String(45))
    last_activity = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    user = db.relationship('User', backref='sessions')