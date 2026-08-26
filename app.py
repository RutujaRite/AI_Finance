import requests
import os
import re
import json
import base64
import uuid
from datetime import date, datetime
from contextlib import contextmanager
from functools import wraps

from flask import Flask, request, jsonify, render_template, render_template_string, send_from_directory, redirect, url_for, session
from flask_session import Session
import psycopg2
from psycopg2.pool import SimpleConnectionPool
from psycopg2.extras import RealDictCursor
from db import getconn as db_getconn, putconn as db_putconn
from duckduckgo_search import DDGS

app = Flask(__name__, static_folder='public', static_url_path='')
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "your-secret-key-change-in-production")
session_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'flask_session')
os.makedirs(session_dir, exist_ok=True)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = session_dir
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = 86400
Session(app)

PROFILE_PHOTO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'uploads', 'profile-photos')
PROFILE_PHOTO_URL_PREFIX = '/uploads/profile-photos/'
MAX_PROFILE_PHOTO_BYTES = 3 * 1024 * 1024

BANK_PDF_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'uploads', 'bank-pdfs')
BANK_PDF_URL_PREFIX = '/uploads/bank-pdfs/'
MAX_BANK_PDF_BYTES = 50 * 1024 * 1024

LOGIN_FAILED_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login Failed</title>
  <link rel="stylesheet" href="style.css">
</head>
<body class="login-page">
  <div class="login-card" style="text-align:center;max-width:440px;">
    <div class="login-logo" style="margin:0 auto 24px;background:linear-gradient(135deg,#EF4444,#F59E0B);">!</div>
    <h1 style="font-size:28px;font-weight:800;color:var(--text);margin-bottom:12px;">Login Failed</h1>
    <p style="font-size:15px;color:var(--text-secondary);margin-bottom:24px;line-height:1.6;">Invalid email or password. Please check your credentials and try again.</p>
    <a href="/" class="btn btn-primary" style="display:inline-flex;width:auto;text-decoration:none;">Try Again</a>
    <p style="margin-top:16px;font-size:14px;color:var(--text-secondary);">Or <a href="/register" style="color:var(--primary);text-decoration:none;font-weight:600;">create a new account</a></p>
  </div>
</body>
</html>
"""

USER_EXISTS_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>User Exists</title>
  <link rel="stylesheet" href="style.css">
</head>
<body class="login-page">
  <div class="login-card" style="text-align:center;max-width:440px;">
    <div class="login-logo" style="margin:0 auto 24px;background:linear-gradient(135deg,#EF4444,#F59E0B);">!</div>
    <h1 style="font-size:28px;font-weight:800;color:var(--text);margin-bottom:12px;">User Already Exists</h1>
    <p style="font-size:15px;color:var(--text-secondary);margin-bottom:24px;line-height:1.6;">This email is already registered. Please use a different email or try logging in.</p>
    <a href="/register" class="btn btn-primary" style="display:inline-flex;width:auto;text-decoration:none;">Try Again</a>
    <p style="margin-top:16px;font-size:14px;color:var(--text-secondary);">Or <a href="/" style="color:var(--primary);text-decoration:none;font-weight:600;">sign in</a></p>
  </div>
</body>
</html>
"""

REGISTRATION_SUCCESS_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Successful</title>
  <link rel="stylesheet" href="style.css">
</head>
<body class="login-page">
  <div class="login-card" style="text-align:center;max-width:440px;">
    <div class="login-logo" style="margin:0 auto 24px;background:linear-gradient(135deg,#10B981,#06B6D4);">✓</div>
    <h1 style="font-size:28px;font-weight:800;color:var(--text);margin-bottom:12px;">Registration Successful</h1>
    <p style="font-size:15px;color:var(--text-secondary);margin-bottom:24px;line-height:1.6;">Account created for {{ name }}. You can now sign in to your account.</p>
    <a href="/" class="btn btn-primary" style="display:inline-flex;width:auto;text-decoration:none;">Login Now</a>
  </div>
</body>
</html>
"""


@contextmanager
def get_db():
    conn = db_getconn()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        db_putconn(conn)


def require_login(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'userId' not in session:
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated


def has_valid_image_signature(buffer, mime_type):
    buf = bytes(buffer)
    if mime_type == "image/jpeg":
        return len(buf) >= 3 and buf[0] == 0xff and buf[1] == 0xd8 and buf[2] == 0xff
    if mime_type == "image/png":
        return len(buf) >= 8 and buf[:8] == bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    if mime_type == "image/webp":
        return len(buf) >= 12 and buf[:4] == b'RIFF' and buf[8:12] == b'WEBP'
    return False


def initialize_database():
    with get_db() as cursor:
        os.makedirs(PROFILE_PHOTO_DIR, exist_ok=True)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(150) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            )
        """)

        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS name VARCHAR(100),
            ADD COLUMN IF NOT EXISTS mobile VARCHAR(30),
            ADD COLUMN IF NOT EXISTS dob DATE,
            ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
            ADD COLUMN IF NOT EXISTS address TEXT,
            ADD COLUMN IF NOT EXISTS city VARCHAR(100),
            ADD COLUMN IF NOT EXISTS pincode VARCHAR(20),
            ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
            ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user',
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
            ADD COLUMN IF NOT EXISTS occupation VARCHAR(100),
            ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50),
            ADD COLUMN IF NOT EXISTS monthly_income NUMERIC,
            ADD COLUMN IF NOT EXISTS marital_status VARCHAR(30),
            ADD COLUMN IF NOT EXISTS residence_type VARCHAR(50),
            ADD COLUMN IF NOT EXISTS pan VARCHAR(20),
            ADD COLUMN IF NOT EXISTS aadhar VARCHAR(30),
            ADD COLUMN IF NOT EXISTS profile_photo_path VARCHAR(255)
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS emi_calculations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                loan_type VARCHAR(100),
                loan_amount NUMERIC,
                annual_rate NUMERIC,
                processing_fee_percent NUMERIC,
                term_months INTEGER,
                months_or_years VARCHAR(10),
                monthly_emi NUMERIC,
                total_interest NUMERIC,
                total_payment NUMERIC,
                processing_fee_amount NUMERIC,
                schedule JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bank_uploaded_files (
                id SERIAL PRIMARY KEY,
                file_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size BIGINT DEFAULT 0,
                uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            ALTER TABLE bank_uploaded_files
            ADD COLUMN IF NOT EXISTS file_path VARCHAR(500),
            ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bank_company_data (
                id SERIAL PRIMARY KEY,
                file_id INTEGER NOT NULL REFERENCES bank_uploaded_files(id) ON DELETE CASCADE,
                company_name VARCHAR(255) NOT NULL,
                bank_name VARCHAR(255) NOT NULL,
                sr_no VARCHAR(100),
                company_category VARCHAR(100),
                other_info TEXT
            )
        """)

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_bank_company_name ON bank_company_data(company_name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_bank_company_bank_name ON bank_company_data(bank_name)")
        cursor.execute("ALTER TABLE bank_company_data ADD COLUMN IF NOT EXISTS sr_no VARCHAR(100)")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS company_basic_info (
                id SERIAL PRIMARY KEY,
                company_name VARCHAR(255) NOT NULL UNIQUE,
                industry VARCHAR(100),
                address TEXT,
                website VARCHAR(255),
                cin VARCHAR(21),
                incorporation_date VARCHAR(50),
                listing_status VARCHAR(100),
                country VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS company_financial_info (
                id SERIAL PRIMARY KEY,
                company_name VARCHAR(255) NOT NULL UNIQUE,
                employees VARCHAR(50),
                turnover TEXT,
                profit_status VARCHAR(50),
                last_agm VARCHAR(50),
                profit_history TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("SELECT * FROM users WHERE email = %s", ("admin@gmail.com",))
        if cursor.fetchone() is None:
            cursor.execute(
                "INSERT INTO users (name, email, password) VALUES (%s, %s, %s)",
                ("Admin", "admin@gmail.com", "1234")
            )


@app.route('/')
def index():
    error = request.args.get('error')
    return render_template('login.html', error=error)


@app.route('/login', methods=['POST'])
def login():
    email = request.form.get('email', '')
    password = request.form.get('password', '')

    try:
        with get_db() as cursor:
            cursor.execute("SELECT * FROM users WHERE email = %s AND password = %s", (email, password))
            user = cursor.fetchone()

            if user:
                session['userId'] = user['id']
                session['userName'] = user['name'] if user['name'] else email.split('@')[0]
                session['userEmail'] = user['email']
                session.permanent = True

                try:
                    cursor.execute("UPDATE users SET last_login = NOW() WHERE id = %s", (user['id'],))
                except Exception as e:
                    print('Failed to update last_login:', e)

                return redirect(url_for('home'))

            return redirect(url_for('index', error='invalid'))
    except Exception as e:
        print("Login error:", e)
        return "Login failed. Please try again.", 500


@app.route('/register')
def register_page():
    return send_from_directory('public', 'register.html')


@app.route('/register', methods=['POST'])
def register_post():
    name = request.form.get('name', '')
    email = request.form.get('email', '')
    password = request.form.get('password', '')

    if not name or not email or not password:
        return "All fields are required.", 400

    try:
        with get_db() as cursor:
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            if cursor.fetchone():
                return render_template_string(USER_EXISTS_HTML)

            cursor.execute(
                "INSERT INTO users (name, email, password) VALUES (%s, %s, %s)",
                (name, email, password)
            )

            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()

            session['userId'] = user['id']
            session['userName'] = user['name'] if user['name'] else email.split('@')[0]
            session['userEmail'] = user['email']
            session.permanent = True

            return redirect(url_for('home'))
    except Exception as e:
        print("Registration error:", e)
        return "Registration failed. Please try again.", 500


@app.route('/home')
@require_login
def home():
    userName = session.get('userName', 'Guest')
    userEmail = session.get('userEmail', 'user@example.com')
    return render_template('home.html', userName=userName, userEmail=userEmail)


@app.route('/emi')
@require_login
def emi():
    userName = session.get('userName', 'Guest')
    return render_template('emi.html', userName=userName)


@app.route('/profile')
@require_login
def profile():
    userId = session['userId']
    try:
        with get_db() as cursor:
            cursor.execute("""
                SELECT id, name, email, mobile, dob, gender, address, city, pincode,
                       occupation, employment_type, monthly_income, marital_status,
                       residence_type, pan, aadhar, status, role, last_login, profile_photo_path
                FROM users WHERE id = %s
            """, (userId,))
            user = cursor.fetchone()

            if not user:
                return redirect(url_for('logout'))

            dob_val = ''
            if user['dob']:
                if isinstance(user['dob'], (date, datetime)):
                    dob_val = user['dob'].isoformat()[:10]
                else:
                    dob_val = str(user['dob'])[:10]

            last_login = 'Never'
            if user['last_login']:
                if isinstance(user['last_login'], datetime):
                    last_login = user['last_login'].strftime('%m/%d/%Y, %I:%M:%S %p')
                else:
                    last_login = str(user['last_login'])

            name_or_email = user['name'] or user['email'] or 'U'
            parts = re.split(r'[\s@]', name_or_email)
            parts = [p for p in parts if p][:2]
            initials = ''.join(p[0] for p in parts).upper()

            profile_photo_url = ''
            if isinstance(user['profile_photo_path'], str) and re.match(r'^/uploads/profile-photos/[a-zA-Z0-9.-]+$', user['profile_photo_path']):
                profile_photo_url = user['profile_photo_path']

            if profile_photo_url:
                avatar_content = f'<img class="profile-photo" src="{profile_photo_url}" alt="Profile photo">'
            else:
                avatar_content = f'<span class="avatar-initials">{initials}</span>'

            remove_photo_button = ''
            if profile_photo_url:
                remove_photo_button = '<button type="button" class="avatar-remove" id="removeProfilePhotoBtn" aria-label="Remove profile photo" title="Remove profile photo">×</button>'

            return render_template('profile.html',
                user=user,
                dob_val=dob_val,
                last_login=last_login,
                initials=initials,
                profile_photo_url=profile_photo_url,
                avatar_content=avatar_content,
                remove_photo_button=remove_photo_button
            )
    except Exception as e:
        print('Profile error', e)
        return "Server error", 500


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))


@app.route('/profile/update', methods=['POST'])
@require_login
def profile_update():
    userId = session['userId']
    data = request.get_json() or {}

    try:
        with get_db() as cursor:
            cursor.execute("""
                UPDATE users SET
                    name=%s, email=%s, mobile=%s, dob=%s, gender=%s,
                    address=%s, city=%s, pincode=%s,
                    occupation=%s, employment_type=%s, monthly_income=%s,
                    marital_status=%s, residence_type=%s, pan=%s, aadhar=%s
                WHERE id=%s
            """, (
                data.get('name') or None,
                data.get('email') or None,
                data.get('mobile') or None,
                data.get('dob') or None,
                data.get('gender') or None,
                data.get('address') or None,
                data.get('city') or None,
                data.get('pincode') or None,
                data.get('occupation') or None,
                data.get('employment_type') or None,
                data.get('monthly_income') or None,
                data.get('marital_status') or None,
                data.get('residence_type') or None,
                data.get('pan') or None,
                data.get('aadhar') or None,
                userId
            ))

            session['userName'] = data.get('name') or session['userName']
            session['userEmail'] = data.get('email') or session['userEmail']

            return jsonify({'success': True})
    except Exception as e:
        print('Profile update error', e)
        return jsonify({'success': False, 'error': 'Update failed'})


@app.route('/profile/photo', methods=['POST'])
@require_login
def upload_profile_photo():
    userId = session['userId']
    data = request.get_json() or {}
    imageData = data.get('image')

    match = None
    if isinstance(imageData, str):
        match = re.match(r'^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$', imageData)

    if not match:
        return jsonify({'success': False, 'error': 'Use a JPG, PNG, or WebP image.'}), 400

    mimeType = match.group(1)
    base64_str = re.sub(r'\s+', '', match.group(2))
    try:
        imageBuffer = base64.b64decode(base64_str)
    except Exception:
        return jsonify({'success': False, 'error': 'The selected image is invalid or exceeds 3 MB.'}), 400

    if not imageBuffer or len(imageBuffer) > MAX_PROFILE_PHOTO_BYTES or not has_valid_image_signature(imageBuffer, mimeType):
        return jsonify({'success': False, 'error': 'The selected image is invalid or exceeds 3 MB.'}), 400

    extension = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}.get(mimeType)
    if not extension:
        return jsonify({'success': False, 'error': 'Use a JPG, PNG, or WebP image.'}), 400

    fileName = f"{userId}-{os.urandom(20).hex()}.{extension}"
    filePath = os.path.join(PROFILE_PHOTO_DIR, fileName)
    publicPath = f"{PROFILE_PHOTO_URL_PREFIX}{fileName}"

    try:
        with get_db() as cursor:
            cursor.execute('SELECT profile_photo_path FROM users WHERE id = %s', (userId,))
            result = cursor.fetchone()
            currentPath = result['profile_photo_path'] if result and isinstance(result['profile_photo_path'], str) else ''

            if currentPath and currentPath.startswith(PROFILE_PHOTO_URL_PREFIX):
                oldFile = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', currentPath.lstrip('/'))
                try:
                    os.unlink(oldFile)
                except OSError:
                    pass

            fd = os.open(filePath, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'wb') as f:
                f.write(imageBuffer)

            cursor.execute('UPDATE users SET profile_photo_path = %s WHERE id = %s', (publicPath, userId))

            return jsonify({'success': True, 'photoPath': publicPath})
    except Exception as e:
        print('Profile photo upload error', e)
        try:
            os.unlink(filePath)
        except OSError:
            pass
        return jsonify({'success': False, 'error': 'Could not save the profile photo.'}), 500


@app.route('/profile/photo', methods=['DELETE'])
@require_login
def delete_profile_photo():
    userId = session['userId']
    try:
        with get_db() as cursor:
            cursor.execute('SELECT profile_photo_path FROM users WHERE id = %s', (userId,))
            result = cursor.fetchone()
            if not result:
                return jsonify({'success': False, 'error': 'User account was not found.'}), 404

            currentPath = result['profile_photo_path']
            if currentPath and currentPath.startswith(PROFILE_PHOTO_URL_PREFIX):
                fileName = currentPath.replace(PROFILE_PHOTO_URL_PREFIX, '')
                filePath = os.path.join(PROFILE_PHOTO_DIR, fileName)
                try:
                    os.unlink(filePath)
                except OSError:
                    pass

            cursor.execute('UPDATE users SET profile_photo_path = NULL WHERE id = %s', (userId,))
            return jsonify({'success': True})
    except Exception as e:
        print('Profile photo delete error', e)
        return jsonify({'success': False, 'error': 'Could not delete the profile photo.'}), 500


@app.route('/profile/change-password', methods=['POST'])
@require_login
def change_password():
    userId = session['userId']
    data = request.get_json() or {}
    newPassword = data.get('newPassword')

    if not newPassword or len(newPassword) < 4:
        return jsonify({'success': False, 'error': 'Invalid password'})

    try:
        with get_db() as cursor:
            cursor.execute('UPDATE users SET password = %s WHERE id = %s', (newPassword, userId))
            return jsonify({'success': True})
    except Exception as e:
        print('Change password error', e)
        return jsonify({'success': False, 'error': 'Change failed'})


@app.route('/emi/save', methods=['POST'])
@require_login
def save_emi():
    userId = session['userId']
    data = request.get_json() or {}

    try:
        with get_db() as cursor:
            cursor.execute("""
                INSERT INTO emi_calculations
                    (user_id, loan_type, loan_amount, annual_rate, processing_fee_percent,
                     term_months, months_or_years, monthly_emi, total_interest,
                     total_payment, processing_fee_amount, schedule)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                userId,
                data.get('loanType') or None,
                data.get('principal') or 0,
                data.get('annualRate') or 0,
                data.get('feePercent') or 0,
                data.get('termMonths') or 0,
                data.get('monthsOrYears') or None,
                data.get('emi') or 0,
                data.get('totalInterest') or 0,
                data.get('totalPayment') or 0,
                data.get('processingFeeAmount') or 0,
                json.dumps(data['schedule']) if data.get('schedule') else None
            ))
            return jsonify({'success': True})
    except Exception as e:
        print('EMI save error', e)
        return jsonify({'success': False, 'error': 'Save failed'})


@app.route('/admin')
@require_login
def admin_panel():
    userName = session.get('userName', 'Guest')
    return render_template('admin.html', userName=userName)


@app.route('/api/admin/users', methods=['GET'])
@require_login
def list_all_users():
    try:
        with get_db() as cursor:
            cursor.execute("""
                SELECT id, name, email, role, status, created_at, last_login
                FROM users
                ORDER BY created_at DESC
            """)
            users = cursor.fetchall()
            return jsonify({'users': [dict(u) for u in users]})
    except Exception as e:
        print('List users error', e)
        return jsonify({'users': []})


@app.route('/api/bank/files', methods=['GET'])
@require_login
def list_bank_files():
    try:
        with get_db() as cursor:
            cursor.execute("""
                SELECT bf.id, bf.file_name, bf.file_path, bf.file_size, bf.uploaded_by, bf.uploaded_at,
                       u.name as uploaded_by_name
                FROM bank_uploaded_files bf
                LEFT JOIN users u ON bf.uploaded_by = u.id
                ORDER BY bf.uploaded_at DESC
            """)
            files = cursor.fetchall()
            return jsonify({'files': [dict(f) for f in files]})
    except Exception as e:
        print('List bank files error', e)
        return jsonify({'files': []})


@app.route('/api/bank/upload', methods=['POST'])
@require_login
def upload_bank_file():
    userId = session.get('userId')
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400
    
    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'}), 400
    
    original_name = file.filename
    ext = os.path.splitext(original_name)[1].lower()
    if ext not in ('.pdf', '.csv'):
        return jsonify({'success': False, 'error': 'Only PDF and CSV files are allowed'}), 400
    
    file.seek(0, 2)
    fileSize = file.tell()
    file.seek(0)
    
    if fileSize > MAX_BANK_PDF_BYTES:
        return jsonify({'success': False, 'error': 'File size exceeds 50 MB limit'}), 400
    
    fileId = uuid.uuid4().hex
    savedName = fileId + ext
    filePath = os.path.join(BANK_PDF_DIR, savedName)
    
    try:
        os.makedirs(BANK_PDF_DIR, exist_ok=True)
        file.save(filePath)
        
        with get_db() as cursor:
            cursor.execute("""
                INSERT INTO bank_uploaded_files (file_name, file_path, file_size, uploaded_by)
                VALUES (%s, %s, %s, %s)
                RETURNING id, file_name, uploaded_at
            """, (original_name, BANK_PDF_URL_PREFIX + savedName, fileSize, userId))
            result = cursor.fetchone()
            
            return jsonify({
                'success': True,
                'file': {
                    'id': result['id'],
                    'file_name': result['file_name'],
                    'file_path': BANK_PDF_URL_PREFIX + savedName,
                    'file_size': fileSize,
                    'uploaded_by': userId,
                    'uploaded_at': result['uploaded_at'].isoformat() if result['uploaded_at'] else None
                }
            })
    except Exception as e:
        print('Bank file upload error', e)
        try:
            os.unlink(filePath)
        except OSError:
            pass
        return jsonify({'success': False, 'error': 'Could not save the file'}), 500


@app.route('/api/bank/files/<int:file_id>', methods=['DELETE'])
@require_login
def delete_bank_file(file_id):
    try:
        with get_db() as cursor:
            cursor.execute('SELECT file_path FROM bank_uploaded_files WHERE id = %s', (file_id,))
            result = cursor.fetchone()
            
            if not result:
                return jsonify({'success': False, 'error': 'File not found'}), 404
            
            filePath = result['file_path']
            if filePath and filePath.startswith(BANK_PDF_URL_PREFIX):
                fileName = filePath.replace(BANK_PDF_URL_PREFIX, '')
                fullPath = os.path.join(BANK_PDF_DIR, fileName)
                try:
                    os.unlink(fullPath)
                except OSError:
                    pass
            
            cursor.execute('DELETE FROM bank_uploaded_files WHERE id = %s', (file_id,))
            return jsonify({'success': True})
    except Exception as e:
        print('Delete bank file error', e)
        return jsonify({'success': False, 'error': 'Could not delete the file'}), 500


@app.route('/api/bank/files/<int:file_id>/download', methods=['GET'])
@require_login
def download_bank_file(file_id):
    try:
        with get_db() as cursor:
            cursor.execute('SELECT file_name, file_path FROM bank_uploaded_files WHERE id = %s', (file_id,))
            result = cursor.fetchone()
            
            if not result:
                return jsonify({'success': False, 'error': 'File not found'}), 404
            
            filePath = result['file_path']
            fileName = result['file_name']
            
            if filePath and filePath.startswith(BANK_PDF_URL_PREFIX):
                localFile = filePath.replace(BANK_PDF_URL_PREFIX, '')
                fullPath = os.path.join(BANK_PDF_DIR, localFile)
                if os.path.exists(fullPath):
                    return send_from_directory(
                        BANK_PDF_DIR,
                        localFile,
                        as_attachment=True,
                        download_name=fileName
                    )
            
            return jsonify({'success': False, 'error': 'File not found on disk'}), 404
    except Exception as e:
        print('Download bank file error', e)
        return jsonify({'success': False, 'error': 'Could not download the file'}), 500


BANK_MANAGER_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'uploads', 'bank-managers')
BANK_MANAGER_UPLOAD_PREFIX = '/uploads/bank-managers/'
MAX_BANK_MANAGER_FILE_BYTES = 50 * 1024 * 1024


@app.route('/bank-managers')
@require_login
def bank_managers_panel():
    userName = session.get('userName', 'Guest')
    return render_template('bank_manager/bank_managers.html', userName=userName)


@app.route('/api/bank-managers', methods=['GET'])
@require_login
def list_bank_managers():
    try:
        from bank_service import search_bank_manager
        result = search_bank_manager()
        return jsonify({'managers': result.get('managers', [])})
    except Exception as e:
        print('List managers error', e)
        return jsonify({'managers': []})


@app.route('/api/bank-managers/search', methods=['GET'])
def search_bank_managers():
    bank_name = request.args.get('bank_name', '')
    location = request.args.get('location', '') or request.args.get('city', '')
    try:
        from bank_service import search_bank_manager
        result = search_bank_manager(bank_name=bank_name, city=location)
        return jsonify({'managers': result.get('managers', [])})
    except Exception as e:
        print('Search managers error', e)
        return jsonify({'managers': []})


@app.route('/api/bank-managers/files', methods=['GET'])
@require_login
def list_bank_manager_files():
    try:
        with get_db() as cursor:
            cursor.execute("""
                SELECT bmf.id, bmf.bank_name, bmf.file_name, bmf.file_path, bmf.file_size, bmf.uploaded_at, u.name as uploaded_by_name
                FROM bank_manager_files bmf
                LEFT JOIN users u ON bmf.uploaded_by = u.id
                ORDER BY bmf.uploaded_at DESC
            """)
            files = cursor.fetchall()
            return jsonify({'files': [dict(f) for f in files]})
    except Exception as e:
        print('List files error', e)
        return jsonify({'files': []})


@app.route('/api/bank-managers/upload', methods=['POST'])
@require_login
def upload_bank_manager_file():
    bank_name = request.form.get('bank_name', '').strip()
    if not bank_name:
        return jsonify({'success': False, 'error': 'Bank name is required'}), 400

    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'}), 400

    original_name = file.filename
    ext = os.path.splitext(original_name)[1].lower()
    if ext not in ('.xlsx', '.xls', '.csv'):
        return jsonify({'success': False, 'error': 'Only Excel and CSV files are allowed'}), 400

    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)

    if file_size > MAX_BANK_MANAGER_FILE_BYTES:
        return jsonify({'success': False, 'error': 'File size exceeds 50 MB limit'}), 400

    file_id = uuid.uuid4().hex
    saved_name = file_id + ext
    file_path = os.path.join(BANK_MANAGER_UPLOAD_DIR, saved_name)
    public_path = BANK_MANAGER_UPLOAD_PREFIX + saved_name

    try:
        os.makedirs(BANK_MANAGER_UPLOAD_DIR, exist_ok=True)
        file.save(file_path)

        with get_db() as cursor:
            cursor.execute("""
                INSERT INTO bank_manager_files (bank_name, file_name, file_path, file_size, uploaded_by)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (bank_name, original_name, public_path, file_size, session.get('userId')))
            db_file_id = cursor.fetchone()['id']

        try:
            from import_managers import import_managers_from_file
            import_managers_from_file(file_path, bank_name)
        except Exception as import_error:
            print('Import error', import_error)

        return jsonify({'success': True, 'file_id': db_file_id})
    except Exception as e:
        print('Upload error', e)
        try:
            os.unlink(file_path)
        except OSError:
            pass
        return jsonify({'success': False, 'error': 'Could not save the file'}), 500


@app.route('/api/bank-managers/files/<int:file_id>', methods=['DELETE'])
@require_login
def delete_bank_manager_file(file_id):
    try:
        with get_db() as cursor:
            cursor.execute('SELECT file_path, bank_name FROM bank_manager_files WHERE id = %s', (file_id,))
            result = cursor.fetchone()

            if not result:
                return jsonify({'success': False, 'error': 'File not found'}), 404

            file_path = result['file_path']
            bank_name = result['bank_name']

            if file_path and file_path.startswith(BANK_MANAGER_UPLOAD_PREFIX):
                local_file = file_path.replace(BANK_MANAGER_UPLOAD_PREFIX, '')
                full_path = os.path.join(BANK_MANAGER_UPLOAD_DIR, local_file)
                try:
                    os.unlink(full_path)
                except OSError:
                    pass

            cursor.execute('DELETE FROM bank_managers WHERE bank_name = %s', (bank_name,))
            cursor.execute('DELETE FROM bank_manager_files WHERE id = %s', (file_id,))
            return jsonify({'success': True})
    except Exception as e:
        print('Delete error', e)
        return jsonify({'success': False, 'error': 'Could not delete the file'}), 500


@app.route('/api/bank-managers/recommend', methods=['GET'])
def recommend_bank_manager():
    location = request.args.get('location', '')
    bank_name = request.args.get('bank_name', '')
    try:
        from bank_service import search_bank_manager
        result = search_bank_manager(bank_name=bank_name, city=location)
        managers = result.get('managers', [])[:5]
        return jsonify({'managers': managers})
    except Exception as e:
        print('Recommend manager error', e)
        return jsonify({'managers': []})


DB_ERROR_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Database Error</title>
  <link rel="stylesheet" href="style.css">
</head>
<body class="login-page">
  <div class="login-card" style="text-align:center;max-width:600px;">
    <div class="login-logo" style="margin:0 auto 24px;background:linear-gradient(135deg,#EF4444,#F59E0B);">!</div>
    <h1 style="font-size:28px;font-weight:800;color:var(--text);margin-bottom:12px;">Database Connection Error</h1>
    <p style="font-size:15px;color:var(--text-secondary);margin-bottom:24px;line-height:1.6;">Could not connect to PostgreSQL.</p>
    <p style="font-size:14px;color:var(--text-secondary);line-height:1.6;">
      Please check your database credentials in <strong>db.py</strong> or set these environment variables:<br>
      <code style="display:block;margin-top:12px;padding:14px;background:var(--bg);border-radius:var(--radius);font-size:13px;text-align:left;border:1px solid var(--border);">
        DB_USER=postgres<br>
        DB_PASSWORD=your_password<br>
        DB_HOST=127.0.0.1<br>
        DB_PORT=5432<br>
        DB_NAME=login_db
      </code>
    </p>
    <p style="margin-top:18px;font-size:13px;color:var(--text-muted);">
      Make sure PostgreSQL is running and the database <strong>login_db</strong> exists.
    </p>
  </div>
</body>
</html>"""

@app.route('/api/chat', methods=['POST'])
def chat_api():
    data = request.get_json() or {}
    message = str(data.get('message') or '').strip()
    conversation_id = data.get('conversation_id')

    if not message:
        return jsonify({'success': False, 'error': 'Message is required'}), 400

    try:
        lower_message = message.lower()
        reply = "I'm here to help with loans, EMI calculations, and account questions. Could you tell me more?"

        if 'emi' in lower_message or 'loan' in lower_message or 'interest' in lower_message:
            reply = "You can use the EMI Calculator on the EMI page to calculate monthly payments, total interest, and view the amortization schedule."

        company_data = None
        company_query = None

        if 'company' in lower_message or 'search company' in lower_message or 'bank record' in lower_message or 'which bank' in lower_message:
            company_query = message.strip()
            for prefix in ['search company', 'search for company', 'find company', 'company', 'search ']:
                if company_query.lower().startswith(prefix):
                    company_query = company_query[len(prefix):].strip()
                    break
            if company_query:
                try:
                    company_resp = requests.post(
                        request.url_root + 'api/company/search',
                        json={'company_name': company_query},
                        headers={'Content-Type': 'application/json'},
                        timeout=15
                    )
                    if company_resp.ok:
                        resp_json = company_resp.json()
                        if resp_json.get('success'):
                            reply = resp_json.get('response') or resp_json.get('ai_message', {}).get('content', 'No company data found.')
                            company_data = resp_json.get('company_data')
                        else:
                            reply = resp_json.get('error', 'Company search failed.')
                    else:
                        reply = 'Company search service returned an error. Please try again later.'
                except Exception as company_error:
                    print('Chat company search error', company_error)
                    reply = 'I tried to search for that company, but the service is unavailable right now. Please try again later.'
            else:
                reply = 'Please provide a company name to search.'
        elif re.search(r'\b(PRIVATE LIMITED|LIMITED|PVT\.?\s*LTD|LTD|INC|CORP)\b', message, re.IGNORECASE):
            company_query = message.strip()
            try:
                company_resp = requests.post(
                    request.url_root + 'api/company/search',
                    json={'company_name': company_query},
                    headers={'Content-Type': 'application/json'},
                    timeout=15
                )
                if company_resp.ok:
                    resp_json = company_resp.json()
                    if resp_json.get('success'):
                        reply = resp_json.get('response') or resp_json.get('ai_message', {}).get('content', 'No company data found.')
                        company_data = resp_json.get('company_data')
                    else:
                        reply = resp_json.get('error', 'Company search failed.')
                else:
                    reply = 'Company search service returned an error. Please try again later.'
            except Exception as company_error:
                print('Chat company search error', company_error)
                reply = 'I tried to search for that company, but the service is unavailable right now. Please try again later.'
        elif 'bank manager' in lower_message or 'manager details' in lower_message or 'branch manager' in lower_message or ('bank' in lower_message and ('manager' in lower_message or 'managers' in lower_message or 'branch' in lower_message or 'contact' in lower_message or 'details' in lower_message)):
            try:
                from ai_agent import run_ai_agent
                reply = run_ai_agent(message)
            except Exception as ai_error:
                print('AI agent error', ai_error)
                reply = 'I tried to search for bank managers, but the service is unavailable right now. Please try again later.'
        elif 'account' in lower_message or 'profile' in lower_message or 'personal' in lower_message:
            reply = "You can update your profile details, upload a profile photo, and change your password from the Profile page."
        elif 'register' in lower_message or 'signup' in lower_message or 'create account' in lower_message:
            reply = "You can create a new account from the Register page. If you already have an account, you can log in from the home page."
        elif 'help' in lower_message or 'support' in lower_message:
            reply = "I can help you with EMI calculations, account details, and general questions. Try asking about loans, interest rates, or your profile."
        elif 'interest' in lower_message:
            reply = "Interest is calculated on the remaining loan balance. The EMI Calculator shows a full amortization schedule so you can see how much goes toward interest vs principal each month."
        elif 'processing fee' in lower_message or 'fee' in lower_message:
            reply = "Processing fees are usually a percentage of the loan amount. You can set it in the EMI Calculator to see the exact fee amount and its effect on total payment."
        elif 'save' in lower_message or 'saved' in lower_message:
            reply = "Your EMI calculations can be saved from the calculator. Saved calculations are linked to your account for later reference."
        elif 'logout' in lower_message or 'password' in lower_message:
            reply = "You can log out or change your password from the Profile page. Use the dropdown in the top navigation to access your profile."
        elif 'hello' in lower_message or 'hi' in lower_message or 'hey' in lower_message:
            reply = "Hello! I'm your AI assistant. Ask me anything about EMI calculations, loans, or your account."
        elif 'thank' in lower_message:
            reply = "You're welcome! Let me know if you have any more questions about loans or EMI calculations."
        else:
            try:
                search_results = []
                with DDGS() as ddgs:
                    results = ddgs.text(message, max_results=5)
                    for r in results:
                        search_results.append({
                            'title': r.get('title', ''),
                            'url': r.get('href', ''),
                            'snippet': r.get('body', '')
                        })

                if search_results:
                    reply = f"Here are the top search results for **{message}**:\n\n"
                    for i, result in enumerate(search_results, 1):
                        reply += f"{i}. **{result['title']}**\n"
                        reply += f"   {result['url']}\n"
                        reply += f"   {result['snippet']}\n\n"
                else:
                    reply = f"I searched for \"{message}\" but couldn't find any results. Could you try rephrasing your question?"
            except Exception as search_error:
                print('Search error', search_error)
                reply = f"I tried to search for \"{message}\" but couldn't connect to the search service right now. Please try again later."

        ai_message = {
            'id': uid(),
            'role': 'ai',
            'content': reply,
            'timestamp': now()
        }
        if company_data is not None:
            ai_message['company_data'] = company_data
        if company_query is not None:
            ai_message['company_query'] = company_query

        return jsonify({
            'success': True,
            'conversation_id': conversation_id,
            'title': message[:40] if message else 'New Conversation',
            'ai_message': ai_message,
            'user_message': {
                'id': uid(),
                'role': 'user',
                'content': message,
                'timestamp': now()
            }
        })
    except Exception as e:
        print('Chat API error', e)
        return jsonify({'success': False, 'error': 'Chat failed'})


def uid():
    import uuid
    return str(uuid.uuid4())


def now():
    from datetime import datetime
    return datetime.utcnow().isoformat() + 'Z'


@app.route('/api/conversations', methods=['GET'])
def list_conversations():
    return jsonify({'conversations': []})


@app.route('/api/conversations/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    return jsonify({'id': conversation_id, 'title': 'New Conversation', 'pinned': False, 'messages': []})


@app.route('/api/conversations/<conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    return jsonify({'success': True})


@app.route('/api/conversations/<conversation_id>/pin', methods=['POST'])
def pin_conversation(conversation_id):
    data = request.get_json() or {}
    return jsonify({'success': True, 'pinned': data.get('pinned', False)})


@app.route('/api/company/search', methods=['POST'])
def company_search():
    data = request.get_json() or {}
    company_name = data.get('company_name', '')
    if not company_name:
        return jsonify({'success': False, 'error': 'company_name is required'}), 400

    try:
        with get_db() as cursor:
            pattern = f'%{company_name}%'
            cursor.execute("""
                SELECT bcd.bank_name, bcd.sr_no, bcd.company_category, bcd.other_info
                FROM bank_company_data bcd
                WHERE LOWER(bcd.company_name) LIKE LOWER(%s)
                ORDER BY bcd.company_name, bcd.bank_name, bcd.sr_no
                LIMIT 200
            """, (pattern,))
            bank_rows = cursor.fetchall()

            if not bank_rows:
                return jsonify({
                    'success': True,
                    'company_name': company_name,
                    'response': f'{company_name} not available in records',
                    'company_data': None,
                    'company_query': company_name,
                    'ai_message': {
                        'role': 'ai',
                        'content': f'{company_name} not available in records',
                        'timestamp': now()
                    }
                })

            matched_names = list({(row['company_name'] or '') for row in bank_rows if row.get('company_name')})
            matched_names.sort()
            primary_name = matched_names[0] if matched_names else company_name

            reply_text = f"Found {len(bank_rows)} bank record(s) for **{primary_name}**."

            return jsonify({
                'success': True,
                'company_name': company_name,
                'response': reply_text,
                'company_data': {
                    'company_name': primary_name,
                    'bank_records': [
                        {
                            'bank_name': row.get('bank_name'),
                            'sr_no': row.get('sr_no'),
                            'company_category': row.get('company_category'),
                            'other_info': row.get('other_info')
                        }
                        for row in bank_rows
                    ]
                },
                'company_query': company_name,
                'ai_message': {
                    'role': 'ai',
                    'content': reply_text,
                    'company_data': {
                        'company_name': primary_name,
                        'bank_records': [
                            {
                                'bank_name': row.get('bank_name'),
                                'sr_no': row.get('sr_no'),
                                'company_category': row.get('company_category'),
                                'other_info': row.get('other_info')
                            }
                            for row in bank_rows
                        ]
                    },
                    'company_query': company_name,
                    'timestamp': now()
                }
            })
    except Exception as e:
        print('Company search error', e)
        return jsonify({'success': False, 'error': 'Company search failed'}), 500


def _search_company_from_incraax(company_name):
    try:
        params = {
            'q': company_name,
            'format': 'json'
        }
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; EMI-Assistant/1.0)'
        }
        response = requests.get(
            'https://search.incraaxaiautomation.in/search',
            params=params,
            headers=headers,
            timeout=15
        )
        response.raise_for_status()
        payload = response.json()
        results = payload.get('results') or []
        if not results:
            return None

        primary_name = None
        for item in results:
            title = (item.get('title') or '').strip()
            if title:
                primary_name = title
                break
        primary_name = primary_name or company_name

        basic_info = {
            'company_name': primary_name,
            'website': results[0].get('url') if results else None
        }

        snippets = [item.get('content') for item in results[:5] if item.get('content')]
        summary = (
            f"{primary_name} information retrieved from live web search."
            f" Top result: {results[0].get('url', 'N/A')}."
        )

        return {
            'company_name': primary_name,
            'summary': summary,
            'basic_info': basic_info,
            'financial_info': None,
            'bank_groups': []
        }
    except Exception as e:
        print('External company search error', e)
        return None


@app.route('/api/company/<company_name>', methods=['GET'])
def get_company_data(company_name):
    return jsonify({
        'company_name': company_name,
        'basic_info': None,
        'financial_info': None,
        'bank_records': None
    })


@app.route('/api/company/list', methods=['GET'])
def list_companies():
    query = request.args.get('q', '')
    return jsonify({'companies': []})



if __name__ == '__main__':
    try:
        initialize_database()
        print("")
        print("======================================")
        print(" Login Page is running successfully!")
        print(" Open: http://localhost:3000")
        print(" Database: PostgreSQL")
        print("======================================")
        app.run(host="127.0.0.1", port=3000, debug=False)
    except psycopg2.OperationalError as e:
        print("Database connection error:", e)
        print("\nStarting web server with database error page...")
        @app.route('/')
        def db_error():
            return render_template_string(DB_ERROR_HTML)
        app.run(host="127.0.0.1", port=3000, debug=False)
    except Exception as e:
        print("Unexpected error:", e)
        import sys
        sys.exit(1)
