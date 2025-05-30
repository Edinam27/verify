import os
import csv
import qrcode
import base64
import math
import io
from io import BytesIO
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session, send_file
from flask_bootstrap import Bootstrap
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['UPSA_LOCATION'] = 'Auditorium'  # Set UPSA Auditorium as the default location
Bootstrap(app)

# Get student data from CSV - Not used in the new implementation
def get_student_data():
    students = []
    if os.path.exists('students.csv'):
        with open('students.csv', 'r') as file:
            reader = csv.DictReader(file)
            students = list(reader)
    else:
        # Create sample data if no CSV exists
        sample_data = [
            {'id': 'S001', 'name': 'John Doe', 'email': 'john@example.com', 'program': 'Computer Science', 'location': 'Auditorium'},
            {'id': 'S002', 'name': 'Jane Smith', 'email': 'jane@example.com', 'program': 'Business Administration', 'location': 'Auditorium'},
            {'id': 'S003', 'name': 'Alex Johnson', 'email': 'alex@example.com', 'program': 'Engineering', 'location': 'Auditorium'}
        ]
        with open('students.csv', 'w', newline='') as file:
            writer = csv.DictWriter(file, fieldnames=['id', 'name', 'email', 'program', 'location'])
            writer.writeheader()
            writer.writerows(sample_data)
        students = sample_data
    return students

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/scan')
def scan():
    return render_template('scan.html')

# Function to calculate distance between two GPS coordinates using Haversine formula
def calculate_distance(lat1, lon1, lat2, lon2):
    # Convert latitude and longitude from degrees to radians
    lat1_rad = math.radians(float(lat1))
    lon1_rad = math.radians(float(lon1))
    lat2_rad = math.radians(float(lat2))
    lon2_rad = math.radians(float(lon2))
    
    # Haversine formula
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    # Radius of Earth in meters
    radius = 6371000
    
    # Calculate distance in meters
    distance = radius * c
    return distance

# Function to get location coordinates from a location name
# In a real application, this would use a geocoding service or database lookup
def get_location_coordinates(location_name):
    # This is a simplified example - in a real application, you would use a geocoding service
    # or have a database with predefined locations and their coordinates
    # For this example, we'll use hardcoded values for the buildings
    location_coords = {
        'Auditorium': {'latitude': 5.6629938944031535, 'longitude': -0.16545574673898403},
        'Building B': {'latitude': 37.7750, 'longitude': -122.4180},
        'Building C': {'latitude': 37.7755, 'longitude': -122.4170},
        'Building D': {'latitude': 37.7760, 'longitude': -122.4160}
    }
    
    return location_coords.get(location_name, {'latitude': 0, 'longitude': 0})

@app.route('/verify', methods=['POST'])
def verify():
    qr_data = request.form.get('qr_data')
    latitude = request.form.get('latitude')
    longitude = request.form.get('longitude')
    student_id = request.form.get('student_id')
    student_name = request.form.get('student_name')
    student_email = request.form.get('student_email')
    student_program = request.form.get('student_program')
    
    if not qr_data:
        return jsonify({'status': 'error', 'message': 'No QR data provided'})
    
    if not latitude or not longitude:
        return jsonify({'status': 'error', 'message': 'Location data is required for verification'})
    
    if not student_id or not student_name or not student_email or not student_program:
        return jsonify({'status': 'error', 'message': 'Student information is required for verification'})
    
    try:
        # Parse QR data (expected format: location_id)
        location_id = qr_data.strip()
        
        # Verify that the QR code is for the UPSA Auditorium
        if location_id != 'UPSA_AUDITORIUM':
            return jsonify({
                'status': 'error',
                'message': 'Invalid QR code. This is not a valid UPSA Auditorium attendance code.'
            })
        
        # Get the registered location coordinates for the UPSA Auditorium
        registered_location = get_location_coordinates(app.config['UPSA_LOCATION'])
        
        # Calculate distance between current location and UPSA Auditorium
        distance = calculate_distance(
            latitude, longitude,
            registered_location['latitude'], registered_location['longitude']
        )
        
        # Check if student is within the allowed radius (300 meters)
        if distance > 300:
            return jsonify({
                'status': 'error',
                'message': f'Verification failed: You are {int(distance)} meters away from {app.config["UPSA_LOCATION"]}. Maximum allowed distance is 300 meters.'
            })
        
        # Get student info
        student_info = {
            'id': student_id,
            'name': student_name,
            'email': student_email,
            'program': student_program,
            'location': app.config['UPSA_LOCATION'],
            'distance': int(distance),
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # Log attendance
        log_attendance(student_info)
        
        return jsonify({
            'status': 'success',
            'student': student_info
        })
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error verifying student: {str(e)}'
        })

def log_attendance(student_info):
    """Log attendance to a CSV file with all student information"""
    attendance_file = 'attendance_log.csv'
    
    # Create file with headers if it doesn't exist
    if not os.path.exists(attendance_file):
        with open(attendance_file, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'name', 'email', 'program', 'location', 'distance', 'coordinates', 'timestamp'])
    
    # Get coordinates from the request if available
    coordinates = f"{request.form.get('latitude', 'N/A')},{request.form.get('longitude', 'N/A')}"
    
    # Append attendance record with all information
    with open(attendance_file, 'a', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([student_info['id'], student_info['name'], student_info['email'], 
                        student_info['program'], student_info['location'], 
                        student_info.get('distance', 'N/A'), coordinates, student_info['timestamp']])
    
    print(f"Attendance logged for {student_info['name']} at {student_info['timestamp']}")
    return True

@app.route('/generate_qr')
def generate_qr():
    """Generate QR code for UPSA Auditorium"""
    # Generate QR code with UPSA Auditorium identifier
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data('UPSA_AUDITORIUM')
    qr.make(fit=True)
    
    # Create QR code image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64 for embedding in HTML
    buffered = BytesIO()
    img.save(buffered)
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return render_template('qr_code.html', location_name=app.config['UPSA_LOCATION'], qr_code=img_str)

# Function to get all available programs
def get_programs():
    programs = []
    if os.path.exists('programs.csv'):
        with open('programs.csv', 'r') as file:
            reader = csv.DictReader(file)
            programs = [row['program_name'] for row in reader]
    return programs

@app.route('/admin')
def admin():
    """Admin page to view attendance logs"""
    attendance_records = []
    if os.path.exists('attendance_log.csv'):
        with open('attendance_log.csv', 'r') as file:
            reader = csv.DictReader(file)
            attendance_records = list(reader)
            
    # Ensure all records have the required fields
    for record in attendance_records:
        if 'coordinates' not in record:
            record['coordinates'] = 'N/A'
        if 'program' not in record:
            record['program'] = 'Unknown'
    
    # Get unique programs from attendance records
    programs = get_programs()
    unique_programs = set(record.get('program', 'Unknown') for record in attendance_records)
    
    return render_template('admin.html', attendance_records=attendance_records, programs=programs, unique_programs=unique_programs)

@app.route('/download_attendance')
def download_attendance():
    """Download attendance records as CSV"""
    program = request.args.get('program', '')
    
    if os.path.exists('attendance_log.csv'):
        # Create a memory file for the filtered CSV
        output = io.StringIO()
        
        with open('attendance_log.csv', 'r') as file:
            # Read the CSV file
            reader = csv.reader(file)
            headers = next(reader)  # Get the header row
            
            # Create a writer with the same headers
            writer = csv.writer(output)
            writer.writerow(headers)  # Write headers to output
            
            # Process each record
            for row in reader:
                # Skip if row doesn't have enough columns
                if len(row) < 4:  # At minimum need id, name, email, program
                    continue
                    
                # Get program from the row (program is at index 3)
                row_program = row[3] if len(row) > 3 else 'Unknown'
                
                # Filter by program if specified
                if not program or row_program == program:
                    writer.writerow(row)
        
        # Prepare the file for download
        output.seek(0)
        filename = f"attendance_{'all' if not program else program.replace(' ', '_')}.csv"
        
        return send_file(
            io.BytesIO(output.getvalue().encode()),
            mimetype='text/csv',
            as_attachment=True,
            download_name=filename
        )
    
    flash('No attendance records found', 'warning')
    return redirect(url_for('admin'))

@app.route('/programs')
def programs():
    """Get all available programs as JSON"""
    programs = get_programs()
    return jsonify(programs)

@app.route('/add_program', methods=['POST'])
def add_program():
    """Add a new program to the list"""
    program_name = request.form.get('program_name', '').strip()
    
    if not program_name:
        flash('Program name cannot be empty', 'danger')
        return redirect(url_for('admin'))
    
    # Check if programs.csv exists, create it if not
    if not os.path.exists('programs.csv'):
        with open('programs.csv', 'w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(['program_name'])
    
    # Check if program already exists
    programs = get_programs()
    if program_name in programs:
        flash(f'Program "{program_name}" already exists', 'warning')
        return redirect(url_for('admin'))
    
    # Add the new program
    with open('programs.csv', 'a', newline='') as file:
        writer = csv.writer(file)
        writer.writerow([program_name])
    
    flash(f'Program "{program_name}" added successfully', 'success')
    return redirect(url_for('admin'))

if __name__ == '__main__':
    # Create upload folder if it doesn't exist
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
