# Student Attendance Verification System

A beautiful Flask web application for verifying student attendance by scanning QR codes. The application confirms a student's email, name, ID, and verifies their physical location using geolocation. Students must be within 300 meters of their registered location for attendance to be verified.

## Features

- QR code scanning for student verification
- Beautiful, responsive UI with Bootstrap
- Support for both CSV and SQLite database
- Admin panel to view attendance records
- QR code generation for testing
- Real-time verification with visual feedback

## Installation

1. Clone this repository or download the files
2. Install the required dependencies:

```
pip install -r requirements.txt
```

## Usage

1. Start the application:

```
python app.py
```

2. Open your browser and navigate to `http://127.0.0.1:5000`
3. Use the "Scan QR Code" button to start the verification process
4. For testing, you can generate sample QR codes using the "Generate Sample QR Code" button
5. View attendance records in the Admin Panel

## Data Source

The application can use either:
- A CSV file named `students.csv` with columns: id, name, email, location
- A SQLite database file named `students.db` with a table named `students`

A sample CSV file is included for testing purposes.

## Requirements

- Python 3.7+
- Flask and other dependencies listed in requirements.txt
- A device with a camera for QR code scanning

## License

MIT