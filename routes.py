import os
from datetime import datetime, timedelta
from flask import session, render_template, request, redirect, url_for, flash, jsonify, send_from_directory
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename
from sqlalchemy import or_, and_, desc, func
from sqlalchemy.orm import joinedload

from app import app, db, socketio
from local_auth import auth
from models import User, Group, GroupMembership, Message, Story, StoryView, Contact, BlockedUser, UserSession
from utils import allowed_file, save_uploaded_file

app.register_blueprint(auth)

@app.before_request
def make_session_permanent():
    session.permanent = True

@app.before_request
def update_last_seen():
    if current_user.is_authenticated:
        current_user.last_seen = datetime.utcnow()
        current_user.is_online = True
        db.session.commit()

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('chat'))
    else:
        return render_template('index.html')

@app.route('/chat')
@login_required
def chat():
    # Get recent conversations
    recent_messages = db.session.query(Message).filter(
        or_(
            Message.sender_id == current_user.id,
            Message.recipient_id == current_user.id
        )
    ).order_by(desc(Message.timestamp)).limit(50).all()
    
    # Get user's groups
    user_groups = db.session.query(Group).join(GroupMembership).filter(
        GroupMembership.user_id == current_user.id
    ).all()
    
    # Get active stories
    active_stories = db.session.query(Story).filter(
        Story.expires_at > datetime.utcnow()
    ).order_by(desc(Story.created_at)).limit(20).all()
    
    return render_template('chat.html', 
                         recent_messages=recent_messages,
                         user_groups=user_groups,
                         active_stories=active_stories)

@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html', user=current_user)

@app.route('/profile/edit', methods=['GET', 'POST'])
@login_required
def edit_profile():
    if request.method == 'POST':
        current_user.username = request.form.get('username', current_user.username)
        current_user.first_name = request.form.get('first_name', current_user.first_name)
        current_user.last_name = request.form.get('last_name', current_user.last_name)
        current_user.bio = request.form.get('bio', current_user.bio)
        current_user.phone_number = request.form.get('phone_number', current_user.phone_number)
        
        # Privacy settings
        current_user.show_last_seen = request.form.get('show_last_seen', current_user.show_last_seen)
        current_user.show_phone = request.form.get('show_phone', current_user.show_phone)
        current_user.show_bio = request.form.get('show_bio', current_user.show_bio)
        current_user.read_receipts = 'read_receipts' in request.form
        
        # Handle profile image upload
        if 'profile_image' in request.files:
            file = request.files['profile_image']
            if file and allowed_file(file.filename):
                filename = save_uploaded_file(file, 'profiles')
                if filename:
                    current_user.profile_image_url = url_for('uploaded_file', filename=f'profiles/{filename}')
        
        db.session.commit()
        flash('Profile updated successfully!', 'success')
        return redirect(url_for('profile'))
    
    return render_template('profile.html', user=current_user, editing=True)

@app.route('/groups')
@login_required
def groups():
    user_groups = db.session.query(Group).join(GroupMembership).filter(
        GroupMembership.user_id == current_user.id
    ).all()
    
    public_groups = db.session.query(Group).filter(
        Group.is_premium == False
    ).limit(20).all()
    
    return render_template('groups.html', user_groups=user_groups, public_groups=public_groups)

@app.route('/groups/create', methods=['GET', 'POST'])
@login_required
def create_group():
    if request.method == 'POST':
        group = Group(
            name=request.form['name'],
            description=request.form.get('description', ''),
            created_by=current_user.id,
            is_premium='is_premium' in request.form,
            premium_price=float(request.form.get('premium_price', 0))
        )
        
        # Handle group image upload
        if 'group_image' in request.files:
            file = request.files['group_image']
            if file and allowed_file(file.filename):
                filename = save_uploaded_file(file, 'groups')
                if filename:
                    group.group_image_url = url_for('uploaded_file', filename=f'groups/{filename}')
        
        db.session.add(group)
        db.session.flush()
        
        # Add creator as admin
        membership = GroupMembership(
            user_id=current_user.id,
            group_id=group.id,
            role='admin',
            is_paid=True
        )
        db.session.add(membership)
        db.session.commit()
        
        flash('Group created successfully!', 'success')
        return redirect(url_for('group_detail', group_id=group.id))
    
    return render_template('groups.html', creating=True)

@app.route('/groups/<int:group_id>')
@login_required
def group_detail(group_id):
    group = Group.query.get_or_404(group_id)
    membership = GroupMembership.query.filter_by(
        user_id=current_user.id,
        group_id=group_id
    ).first()
    
    if not membership:
        flash('You are not a member of this group.', 'error')
        return redirect(url_for('groups'))
    
    messages = Message.query.filter_by(group_id=group_id).order_by(
        desc(Message.timestamp)
    ).limit(50).all()
    
    members = db.session.query(User).join(GroupMembership).filter(
        GroupMembership.group_id == group_id
    ).all()
    
    return render_template('groups.html', group=group, messages=messages, 
                         members=members, membership=membership, viewing=True)

@app.route('/groups/<int:group_id>/join', methods=['POST'])
@login_required
def join_group(group_id):
    group = Group.query.get_or_404(group_id)
    existing_membership = GroupMembership.query.filter_by(
        user_id=current_user.id,
        group_id=group_id
    ).first()
    
    if existing_membership:
        flash('You are already a member of this group.', 'info')
        return redirect(url_for('group_detail', group_id=group_id))
    
    # Check if group is premium and requires payment
    if group.is_premium:
        # In a real app, this would integrate with crypto payment
        flash('Premium group membership requires payment. Payment integration coming soon!', 'warning')
        return redirect(url_for('groups'))
    
    membership = GroupMembership(
        user_id=current_user.id,
        group_id=group_id,
        is_paid=not group.is_premium
    )
    db.session.add(membership)
    db.session.commit()
    
    flash('Successfully joined the group!', 'success')
    return redirect(url_for('group_detail', group_id=group_id))

@app.route('/stories')
@login_required
def stories():
    # Get active stories from contacts or public
    active_stories = db.session.query(Story).filter(
        Story.expires_at > datetime.utcnow()
    ).order_by(desc(Story.created_at)).all()
    
    # Get user's own stories
    my_stories = db.session.query(Story).filter(
        Story.user_id == current_user.id,
        Story.expires_at > datetime.utcnow()
    ).order_by(desc(Story.created_at)).all()
    
    return render_template('stories.html', active_stories=active_stories, my_stories=my_stories)

@app.route('/stories/create', methods=['GET', 'POST'])
@login_required
def create_story():
    if request.method == 'POST':
        story = Story(
            user_id=current_user.id,
            content=request.form.get('content', ''),
            visibility=request.form.get('visibility', 'everyone')
        )
        
        # Handle media upload
        if 'media' in request.files:
            file = request.files['media']
            if file and allowed_file(file.filename):
                filename = save_uploaded_file(file, 'stories')
                if filename:
                    story.media_url = url_for('uploaded_file', filename=f'stories/{filename}')
                    # Determine media type
                    if file.filename and file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                        story.media_type = 'image'
                    elif file.filename and file.filename.lower().endswith(('.mp4', '.avi', '.mov')):
                        story.media_type = 'video'
        
        db.session.add(story)
        db.session.commit()
        
        flash('Story created successfully!', 'success')
        return redirect(url_for('stories'))
    
    return render_template('stories.html', creating=True)

@app.route('/stories/<int:story_id>/view')
@login_required
def view_story(story_id):
    story = Story.query.get_or_404(story_id)
    
    if story.is_expired:
        flash('This story has expired.', 'error')
        return redirect(url_for('stories'))
    
    # Record the view
    existing_view = StoryView.query.filter_by(
        story_id=story_id,
        viewer_id=current_user.id
    ).first()
    
    if not existing_view:
        view = StoryView(story_id=story_id, viewer_id=current_user.id)
        db.session.add(view)
        db.session.commit()
    
    return render_template('stories.html', viewing_story=story)

@app.route('/search')
@login_required
def search():
    query = request.args.get('q', '').strip()
    results = []
    
    if query:
        # Search by username, phone number, or name
        results = User.query.filter(
            or_(
                User.username.ilike(f'%{query}%'),
                User.phone_number.ilike(f'%{query}%'),
                User.first_name.ilike(f'%{query}%'),
                User.last_name.ilike(f'%{query}%'),
                func.concat(User.first_name, ' ', User.last_name).ilike(f'%{query}%')
            )
        ).filter(User.id != current_user.id).limit(20).all()
    
    return render_template('search.html', query=query, results=results)

@app.route('/chat/<user_id>')
@login_required
def direct_chat(user_id):
    other_user = User.query.get_or_404(user_id)
    
    # Check if user is blocked
    blocked = BlockedUser.query.filter_by(
        blocker_id=other_user.id,
        blocked_id=current_user.id
    ).first()
    
    if blocked:
        flash('You cannot message this user.', 'error')
        return redirect(url_for('index'))
    
    # Get conversation history
    messages = Message.query.filter(
        or_(
            and_(Message.sender_id == current_user.id, Message.recipient_id == user_id),
            and_(Message.sender_id == user_id, Message.recipient_id == current_user.id)
        )
    ).order_by(Message.timestamp).all()
    
    return render_template('chat.html', other_user=other_user, messages=messages, direct_chat=True)

@app.route('/settings')
@login_required
def settings():
    # Get active sessions
    active_sessions = UserSession.query.filter_by(
        user_id=current_user.id,
        is_active=True
    ).order_by(desc(UserSession.last_activity)).all()
    
    return render_template('settings.html', active_sessions=active_sessions)

@app.route('/admin')
@login_required
def admin():
    if not current_user.is_admin:
        flash('Access denied. Admin privileges required.', 'error')
        return redirect(url_for('index'))
    
    # Get statistics
    total_users = User.query.count()
    total_groups = Group.query.count()
    total_messages = Message.query.count()
    active_users = User.query.filter(
        User.last_seen > datetime.utcnow() - timedelta(hours=24)
    ).count()
    
    # Get recent users
    recent_users = User.query.order_by(desc(User.created_at)).limit(10).all()
    
    # Get recent groups
    recent_groups = Group.query.order_by(desc(Group.created_at)).limit(10).all()
    
    return render_template('admin.html', 
                         total_users=total_users,
                         total_groups=total_groups,
                         total_messages=total_messages,
                         active_users=active_users,
                         recent_users=recent_users,
                         recent_groups=recent_groups)

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# API endpoints for AJAX requests
@app.route('/api/send_message', methods=['POST'])
@login_required
def api_send_message():
    data = request.get_json()
    
    message = Message(
        content=data.get('content'),
        sender_id=current_user.id,
        recipient_id=data.get('recipient_id'),
        group_id=data.get('group_id'),
        message_type=data.get('message_type', 'text')
    )
    
    db.session.add(message)
    db.session.commit()
    
    # Emit to relevant users via WebSocket
    socketio.emit('new_message', {
        'message_id': message.id,
        'content': message.content,
        'sender': current_user.get_display_name(),
        'timestamp': message.timestamp.isoformat()
    }, to=data.get('room'))
    
    return jsonify({'status': 'success', 'message_id': message.id})

@app.route('/api/mark_read', methods=['POST'])
@login_required
def api_mark_read():
    data = request.get_json()
    message_id = data.get('message_id')
    
    message = Message.query.get(message_id)
    if message and (message.recipient_id == current_user.id or 
                   (message.group_id and current_user.id in [m.user_id for m in message.group.memberships])):
        message.read_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'status': 'success'})
    
    return jsonify({'status': 'error'}), 403

@app.route('/api/typing', methods=['POST'])
@login_required
def api_typing():
    data = request.get_json()
    room = data.get('room')
    is_typing = data.get('is_typing', False)
    
    socketio.emit('typing_status', {
        'user': current_user.get_display_name(),
        'is_typing': is_typing
    }, to=room, include_self=False)
    
    return jsonify({'status': 'success'})

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return render_template('403.html', error_message="Page not found"), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return render_template('403.html', error_message="Internal server error"), 500
