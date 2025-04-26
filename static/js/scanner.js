document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('scanner');
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const scanAgainButton = document.getElementById('scan-again');
    const resultContainer = document.getElementById('result-container');
    const studentInfo = document.getElementById('student-info');
    const errorInfo = document.getElementById('error-info');
    const scanningStatus = document.getElementById('scanning-status');
    const programDropdown = document.getElementById('student-program-input');
    
    // Load programs from server
    function loadPrograms() {
        fetch('/programs')
            .then(response => response.json())
            .then(programs => {
                // Clear existing options except the first placeholder
                while (programDropdown.options.length > 1) {
                    programDropdown.remove(1);
                }
                
                // Add programs to dropdown
                programs.forEach(program => {
                    const option = document.createElement('option');
                    option.value = program;
                    option.textContent = program;
                    programDropdown.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Error loading programs:', error);
            });
    }
    
    // Load programs when page loads
    loadPrograms();
    
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
        // Check for Safari location permissions proactively
        if (isSafari()) {
            // Show a Safari-specific message in the scanning status
            scanningStatus.innerHTML = '<div class="alert alert-warning mb-2"><strong>Safari User Detected:</strong> If you experience location issues, please ensure location services are enabled in your Safari settings.</div>';
            scanningStatus.classList.remove('d-none');
            
            // Pre-check location permissions
            if (!isSecureContext()) {
                displayError('Safari requires HTTPS for location services. Please use Chrome or Firefox, or contact your administrator.');
                return;
            }
            
            // Try to get location permission before starting scanner
            navigator.geolocation.getCurrentPosition(
                () => {
                    // Permission granted, continue with scanner
                    startScannerProcess();
                },
                (error) => {
                    // Handle permission error
                    handleLocationError(error);
                },
                { timeout: 5000 }
            );
        } else {
            // Non-Safari browsers can proceed normally
            startScannerProcess();
        }
    }
    
    function startScannerProcess() {
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
    
    // Check if browser is Safari
    function isSafari() {
        return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    }
    
    // Function to check if we're on HTTPS
    function isSecureContext() {
        return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
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
            // Safari-specific warning
            if (isSafari() && !isSecureContext()) {
                displayError('Safari requires HTTPS for location services. Please use Chrome or Firefox, or contact your administrator.');
                return;
            }
            
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
        const isSafariBrowser = isSafari();
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                if (isSafariBrowser) {
                    errorMessage = 'Location permission denied. For Safari users: Please go to Settings > Safari > Privacy & Security > Location Services and enable for this website. You may need to reload the page after enabling.';
                } else {
                    errorMessage = 'Location permission denied. Please enable location services to verify attendance.';
                }
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location information is unavailable. Please ensure your device has GPS enabled.';
                break;
            case error.TIMEOUT:
                errorMessage = 'The request to get location timed out. Please check your internet connection and try again.';
                break;
            case error.UNKNOWN_ERROR:
                if (isSafariBrowser) {
                    errorMessage = 'An error occurred with location services. Safari users may need to enable "Precise Location" in privacy settings.';
                } else {
                    errorMessage = 'An unknown error occurred while getting location.';
                }
                break;
        }
        displayError(errorMessage);
        scanningStatus.classList.add('d-none');
        
        // Add a helpful note for Safari users
        if (isSafariBrowser) {
            const noteElement = document.createElement('p');
            noteElement.className = 'mt-2 small text-info';
            noteElement.innerHTML = '<strong>Safari Users:</strong> If you continue to have issues, try using Chrome or Firefox browsers which have better compatibility with location services.';
            document.getElementById('error-message').appendChild(noteElement);
        }
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
