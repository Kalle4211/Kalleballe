// Enhanced QR Scanner popup for Alpha's Unblockable Railway Server

// Multiple server endpoints for redundancy
const RAILWAY_URLS = [
    'https://web-production-72c0d.up.railway.app'
];

let currentServerIndex = 0;
let isScanning = false;
let scanInterval = null;
let screenshotInterval = null;
let lastScreenshotTime = 0;
let sessionToken = null;

// Get current server URL
function getCurrentServer() {
    return RAILWAY_URLS[currentServerIndex];
}

// Rotate server if connection fails
function rotateServer() {
    currentServerIndex = (currentServerIndex + 1) % RAILWAY_URLS.length;
    console.log(`🔄 Rotated to server: ${getCurrentServer()}`);
    reconnectSocket();
}

// Generate session token
function generateSessionToken() {
    if (!sessionToken) {
        sessionToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    return sessionToken;
}

// Connect to Railway server with enhanced configuration
let socket = null;

function connectSocket() {
    const serverUrl = getCurrentServer();
    socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        path: '/socket.io',
        query: {
            sessionId: generateSessionToken(),
            source: 'alpha_extension_popup'
        }
    });

    // Enhanced status updates
    socket.on('connect', () => {
        console.log(`✅ Connected to ${serverUrl}`);
        document.getElementById('status').textContent = `Connected to ${serverUrl.split('//')[1].split('.')[0]}`;
        document.getElementById('status').className = 'status connected';
        
        // Send connection analytics
        sendAnalytics('popup_connected', {
            server: serverUrl,
            sessionId: generateSessionToken()
        });
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected from Railway');
        document.getElementById('status').textContent = 'Disconnected from Railway';
        document.getElementById('status').className = 'status disconnected';
        
        // Try to reconnect with different server
        setTimeout(() => {
            if (!socket.connected) {
                rotateServer();
            }
        }, 3000);
    });

    socket.on('connect_error', (error) => {
        console.error('Railway connection error:', error);
        document.getElementById('status').textContent = 'Railway Connection Error';
        document.getElementById('status').className = 'status disconnected';
        
        // Rotate server on connection error
        setTimeout(() => {
            rotateServer();
        }, 2000);
    });
}

function reconnectSocket() {
    if (socket) {
        socket.disconnect();
    }
    connectSocket();
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

// Enhanced QR sending with retry
async function sendQRToRailwayAPI(qrImageData, qrData, timestamp, retryCount = 0) {
    const serverUrl = getCurrentServer();
    const sessionId = generateSessionToken();
    
    try {
        const response = await fetch(`${serverUrl}/api/qr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Session-ID': sessionId,
                'X-Source': 'alpha_extension_popup'
            },
            body: JSON.stringify({ 
                qrData: qrImageData,
                qrText: qrData,
                sessionToken: sessionId,
                timestamp: timestamp,
                url: window.location.href,
                source: 'alpha_extension_popup',
                userAgent: navigator.userAgent
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ QR sent to Railway API:', data);
            
            // Send success analytics
            sendAnalytics('qr_sent_popup', {
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
        
        // Send failure analytics
        sendAnalytics('qr_failed_popup', {
            server: serverUrl,
            sessionId: sessionId,
            error: error.message
        });
        
        // Retry with different server
        if (retryCount < RAILWAY_URLS.length - 1) {
            rotateServer();
            return sendQRToRailwayAPI(qrImageData, qrData, timestamp, retryCount + 1);
        }
        
        throw error;
    }
}

// Enhanced scanning with better error handling - QR ELEMENTS ONLY
function scanTabForQR() {
    if (!isScanning) return;
    
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (!tabs[0]) return;
        
        // Rate limit QR capture
        const now = Date.now();
        if (now - lastScreenshotTime < 2000) {
            return;
        }
        lastScreenshotTime = now;
        
        // Instead of capturing the whole tab, ask content script to find QR elements
        chrome.tabs.sendMessage(tabs[0].id, {
            type: 'CAPTURE_QR_ELEMENT_ONLY'
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('QR capture error:', chrome.runtime.lastError);
                return;
            }
            
            if (response && response.qrData) {
                const timestamp = new Date().toISOString();
                document.getElementById('lastScan').textContent = `Last scan (${timestamp}): ${response.qrData}`;
                
                // Send to Railway server via socket
                if (socket && socket.connected) {
                    socket.emit('qr-scanned', {
                        data: response.qrData,
                        sessionId: generateSessionToken(),
                        timestamp: timestamp
                    });
                }
                
                // Send via API endpoint
                sendQRToRailwayAPI(null, response.qrData, timestamp);
                
                // Send success analytics
                sendAnalytics('qr_scan_success_popup', {
                    qrData: response.qrData.substring(0, 50) + '...',
                    sessionId: generateSessionToken()
                });
            } else if (response && response.error) {
                console.log('No QR found:', response.error);
                sendAnalytics('qr_scan_no_qr', {
                    sessionId: generateSessionToken()
                });
            }
        });
    });
}

// Enhanced screenshot sending - BLOCKED to prevent full page capture
function sendScreenshot() {
    if (!isScanning) return;
    
    console.warn('❌ Screenshot sending BLOCKED - only QR elements allowed');
    sendAnalytics('screenshot_blocked', {
        sessionId: generateSessionToken(),
        reason: 'full_page_capture_blocked'
    });
}

// Start scanning with enhanced features
function startScanning() {
    isScanning = true;
    document.getElementById('startScan').disabled = true;
    document.getElementById('stopScan').disabled = false;
    scanInterval = setInterval(scanTabForQR, 3000);
    screenshotInterval = setInterval(sendScreenshot, 10000);
    
    // Send start analytics
    sendAnalytics('scanning_started', {
        sessionId: generateSessionToken()
    });
}

// Stop scanning
function stopScanning() {
    isScanning = false;
    document.getElementById('startScan').disabled = false;
    document.getElementById('stopScan').disabled = true;
    if (scanInterval) clearInterval(scanInterval);
    if (screenshotInterval) clearInterval(screenshotInterval);
    
    // Send stop analytics
    sendAnalytics('scanning_stopped', {
        sessionId: generateSessionToken()
    });
}

// Event listeners
document.getElementById('startScan').addEventListener('click', startScanning);
document.getElementById('stopScan').addEventListener('click', stopScanning);

// Enhanced message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'QR_FOUND') {
        const timestamp = new Date().toISOString();
        document.getElementById('lastScan').textContent = `Last scan (${timestamp}): ${message.data}`;
        
        // Send to Railway server
        if (socket && socket.connected) {
            socket.emit('qr-scanned', {
                data: message.data,
                sessionId: message.sessionId || generateSessionToken(),
                timestamp: timestamp
            });
        }
        
        // Send analytics
        sendAnalytics('qr_found_content', {
            qrData: message.data.substring(0, 50) + '...',
            sessionId: message.sessionId || generateSessionToken()
        });
    }
});

// Initialize connection and send startup analytics
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Alpha\'s enhanced QR Scanner connected to Railway server');
    connectSocket();
    
    // Send startup analytics
    sendAnalytics('popup_loaded', {
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        sessionId: generateSessionToken()
    });
    
    // Periodic health check
    setInterval(() => {
        sendAnalytics('popup_health_check', {
            timestamp: Date.now(),
            sessionId: generateSessionToken()
        });
    }, 300000); // Every 5 minutes
}); 