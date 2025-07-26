from flask_socketio import emit, join_room, leave_room, rooms
from flask_login import current_user
from datetime import datetime
from app import socketio, db
from models import User, Message, Group, GroupMembership

@socketio.on('connect')
def on_connect():
    if current_user.is_authenticated:
        # Update user status to online
        current_user.is_online = True
        current_user.last_seen = datetime.utcnow()
        db.session.commit()
        
        emit('status_update', {
            'user_id': current_user.id,
            'status': 'online'
        }, broadcast=True)
        
        print(f"User {current_user.get_display_name()} connected")

@socketio.on('disconnect')
def on_disconnect():
    if current_user.is_authenticated:
        # Update user status to offline
        current_user.is_online = False
        current_user.last_seen = datetime.utcnow()
        db.session.commit()
        
        emit('status_update', {
            'user_id': current_user.id,
            'status': 'offline',
            'last_seen': current_user.last_seen.isoformat()
        }, broadcast=True)
        
        print(f"User {current_user.get_display_name()} disconnected")

@socketio.on('join_room')
def on_join_room(data):
    if not current_user.is_authenticated:
        return
    
    room = data['room']
    room_type = data.get('type', 'direct')  # direct or group
    
    if room_type == 'group':
        # Verify user is a member of the group
        group_id = int(room.split('_')[1])  # Format: group_123
        membership = GroupMembership.query.filter_by(
            user_id=current_user.id,
            group_id=group_id
        ).first()
        
        if not membership:
            emit('error', {'message': 'Not authorized to join this room'})
            return
    
    join_room(room)
    emit('joined_room', {'room': room})
    print(f"User {current_user.get_display_name()} joined room {room}")

@socketio.on('leave_room')
def on_leave_room(data):
    if not current_user.is_authenticated:
        return
    
    room = data['room']
    leave_room(room)
    emit('left_room', {'room': room})
    print(f"User {current_user.get_display_name()} left room {room}")

@socketio.on('send_message')
def on_send_message(data):
    if not current_user.is_authenticated:
        return
    
    # Create message in database
    message = Message(
        content=data['content'],
        sender_id=current_user.id,
        message_type=data.get('message_type', 'text')
    )
    
    # Set recipient or group
    if data.get('recipient_id'):
        message.recipient_id = data['recipient_id']
        room = f"user_{min(current_user.id, data['recipient_id'])}_{max(current_user.id, data['recipient_id'])}"
    elif data.get('group_id'):
        message.group_id = data['group_id']
        room = f"group_{data['group_id']}"
        
        # Verify user is a member
        membership = GroupMembership.query.filter_by(
            user_id=current_user.id,
            group_id=data['group_id']
        ).first()
        
        if not membership:
            emit('error', {'message': 'Not authorized to send messages to this group'})
            return
    else:
        emit('error', {'message': 'Invalid message destination'})
        return
    
    db.session.add(message)
    db.session.commit()
    
    # Broadcast message to room
    emit('new_message', {
        'message_id': message.id,
        'content': message.content,
        'sender_id': current_user.id,
        'sender_name': current_user.get_display_name(),
        'sender_image': current_user.profile_image_url,
        'timestamp': message.timestamp.isoformat(),
        'message_type': message.message_type
    }, to=room)
    
    print(f"Message sent by {current_user.get_display_name()} to room {room}")

@socketio.on('typing')
def on_typing(data):
    if not current_user.is_authenticated:
        return
    
    room = data['room']
    is_typing = data.get('is_typing', False)
    
    emit('user_typing', {
        'user_id': current_user.id,
        'user_name': current_user.get_display_name(),
        'is_typing': is_typing
    }, to=room, include_self=False)

@socketio.on('mark_read')
def on_mark_read(data):
    if not current_user.is_authenticated:
        return
    
    message_id = data.get('message_id')
    message = Message.query.get(message_id)
    
    if message and (message.recipient_id == current_user.id):
        message.read_at = datetime.utcnow()
        db.session.commit()
        
        # Notify sender about read receipt
        emit('message_read', {
            'message_id': message_id,
            'read_by': current_user.id,
            'read_at': message.read_at.isoformat()
        }, to=f"user_{message.sender_id}")

@socketio.on('get_online_users')
def on_get_online_users():
    if not current_user.is_authenticated:
        return
    
    online_users = User.query.filter_by(is_online=True).all()
    emit('online_users', {
        'users': [
            {
                'id': user.id,
                'name': user.get_display_name(),
                'image': user.profile_image_url
            } for user in online_users if user.id != current_user.id
        ]
    })

@socketio.on_error_default
def default_error_handler(e):
    print(f"SocketIO error: {e}")
    emit('error', {'message': 'An error occurred'})
