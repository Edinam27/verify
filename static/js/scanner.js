document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('scanner');
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const scanAgainButton = document.getElementById('scan-again');
    const resultContainer = document.getElementById('result-container');
    const studentInfo = document.getElementById('student-info');
    const errorInfo = document.getElementById('error-info');
    const scanningStatus = document.getElementById('scanning-status');
    
    let codeReader;
    let selectedDeviceId;
    
    function initScanner() {
        codeReader = new ZXing.BrowserMultiFormatReader();
        
        codeReader.listVideoInputDevices()
            .then((videoInputDevices) => {
                if (videoInputDevices.length > 0) {
                    // Select the rear camera if available
                    selectedDeviceId = videoInputDevices.find(device => 
                        /(back|rear)/i.test(device.label))?.deviceId || videoInputDevices[0].deviceId;
                }
            })
            .catch(err => {
                console.error('Error listing video devices', err);
            });
    }
    
    function startScanner() {
        startButton.classList.add('d-none');
        stopButton.classList.remove('d-none');
        resultContainer.classList.remove('d-none');
        scanningStatus.classList.remove('d-none');
        studentInfo.classList.add('d-none');
        errorInfo.classList.add('d-none');
        scanAgainButton.classList.add('d-none');
        
        codeReader.decodeFromVideoDevice(selectedDeviceId, 'scanner', (result, err) => {
            if (result) {
                // Stop scanning once we get a result
                codeReader.reset();
                stopButton.classList.add('d-none');
                startButton.classList.add('d-none');
                scanAgainButton.classList.remove('d-none');
                scanningStatus.classList.add('d-none');
                
                // Process the QR code data
                processQRCode(result.text);
            }
            
            if (err && !(err instanceof ZXing.NotFoundException)) {
                console.error('Error during scan', err);
            }
        });
    }
    
    function stopScanner() {
        codeReader.reset();
        startButton.classList.remove('d-none');
        stopButton.classList.add('d-none');
        resultContainer.classList.add('d-none');
    }
    
    function processQRCode(qrData) {
        // Get student information from the form
        const studentId = document.getElementById('student-id-input').value.trim();
        const studentName = document.getElementById('student-name-input').value.trim();
        const studentEmail = document.getElementById('student-email-input').value.trim();
        const studentProgram = document.getElementById('student-program-input').value.trim();
        
        // Validate student information
        if (!studentId || !studentName || !studentEmail || !studentProgram) {
            displayError('Please fill in all student information fields');
            return;
        }
        
        // Get current location before sending verification request
        scanningStatus.textContent = 'Getting your location...';
        scanningStatus.classList.remove('d-none');
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                // Success callback
                (position) => {
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;
                    
                    scanningStatus.textContent = 'Verifying...';
                    
                    // Send the QR data, student info, and location to the server for verification
                    fetch('/verify', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: `qr_data=${encodeURIComponent(qrData)}&latitude=${latitude}&longitude=${longitude}&student_id=${encodeURIComponent(studentId)}&student_name=${encodeURIComponent(studentName)}&student_email=${encodeURIComponent(studentEmail)}&student_program=${encodeURIComponent(studentProgram)}`
                    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                displayStudentInfo(data.student);
            } else {
                displayError(data.message);
            }
        })
        .catch(error => {
            displayError('Error connecting to server: ' + error);
        });
                },
                // Error callback
                (error) => {
                    handleLocationError(error);
                },
                // Options
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            displayError('Geolocation is not supported by this browser. Please use a modern browser with location services.');
        }
    }
    
    function displayStudentInfo(student) {
        // Display student information
        document.getElementById('student-name').textContent = student.name;
        document.getElementById('student-id').textContent = student.id;
        document.getElementById('student-email').textContent = student.email;
        document.getElementById('student-location').textContent = `${student.location} (${student.distance}m away)`;
        document.getElementById('student-program').textContent = student.program;
        document.getElementById('verification-time').textContent = student.timestamp;
        
        // Set initials for avatar
        const nameParts = student.name.split(' ');
        const initials = nameParts.length > 1 
            ? (nameParts[0][0] + nameParts[1][0]).toUpperCase() 
            : student.name.substring(0, 2).toUpperCase();
        document.getElementById('student-initials').textContent = initials;
        
        studentInfo.classList.remove('d-none');
        errorInfo.classList.add('d-none');
    }
    
    function displayError(message) {
        document.getElementById('error-message').textContent = message;
        errorInfo.classList.remove('d-none');
        studentInfo.classList.add('d-none');
    }
    
    // Function to handle geolocation errors
    function handleLocationError(error) {
        let errorMessage;
        switch(error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'Location permission denied. Please enable location services to verify attendance.';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location information is unavailable.';
                break;
            case error.TIMEOUT:
                errorMessage = 'The request to get location timed out.';
                break;
            case error.UNKNOWN_ERROR:
                errorMessage = 'An unknown error occurred while getting location.';
                break;
        }
        displayError(errorMessage);
        scanningStatus.classList.add('d-none');
    }
    
    // Initialize scanner
    initScanner();
    
    // Event listeners
    startButton.addEventListener('click', startScanner);
    stopButton.addEventListener('click', stopScanner);
    scanAgainButton.addEventListener('click', function() {
        studentInfo.classList.add('d-none');
        errorInfo.classList.add('d-none');
        scanAgainButton.classList.add('d-none');
        startButton.classList.remove('d-none');
    });
});