from flask import Blueprint, render_template, redirect, url_for, flash, request, session, g
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from app import app, db
from models import User
import logging

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'
login_manager.login_message = 'Please log in to access this page.'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Create authentication blueprint
auth = Blueprint('auth', __name__, url_prefix='/auth')

@auth.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if not username or not password:
            flash('Please enter both username and password.')
            return render_template('auth/login.html')
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user, remember=True)
            user.is_online = True
            db.session.commit()
            
            # Redirect to next page or home
            next_page = request.args.get('next')
            if next_page:
                return redirect(next_page)
            return redirect(url_for('chat'))
        else:
            flash('Invalid username or password.')
    
    return render_template('auth/login.html')

@auth.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        first_name = request.form.get('first_name')
        last_name = request.form.get('last_name')
        phone_number = request.form.get('phone_number')
        
        # Validation
        if not all([username, email, password]):
            flash('Please fill in all required fields.')
            return render_template('auth/register.html')
        
        if password != confirm_password:
            flash('Passwords do not match.')
            return render_template('auth/register.html')
        
        if password and len(password) < 6:
            flash('Password must be at least 6 characters long.')
            return render_template('auth/register.html')
        
        # Check if user already exists
        if User.query.filter_by(username=username).first():
            flash('Username already exists.')
            return render_template('auth/register.html')
        
        if User.query.filter_by(email=email).first():
            flash('Email already registered.')
            return render_template('auth/register.html')
        
        if phone_number and User.query.filter_by(phone_number=phone_number).first():
            flash('Phone number already registered.')
            return render_template('auth/register.html')
        
        # Create new user
        try:
            user = User(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                phone_number=phone_number
            )
            user.set_password(password)
            
            # First user becomes admin
            if User.query.count() == 0:
                user.is_admin = True
            
            db.session.add(user)
            db.session.commit()
            
            flash('Registration successful! You can now log in.')
            return redirect(url_for('auth.login'))
            
        except Exception as e:
            db.session.rollback()
            logging.error(f"Registration error: {e}")
            flash('Registration failed. Please try again.')
    
    return render_template('auth/register.html')

@auth.route('/logout')
@login_required
def logout():
    current_user.is_online = False
    db.session.commit()
    logout_user()
    flash('You have been logged out.')
    return redirect(url_for('index'))

# Make session permanent for better user experience
@app.before_request
def make_session_permanent():
    session.permanent = True

# Helper function for route protection
def login_required_local(f):
    """Custom login required decorator"""
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return redirect(url_for('auth.login', next=request.url))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function