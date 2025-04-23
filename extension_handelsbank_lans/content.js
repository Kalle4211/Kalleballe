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
        // Specific selectors for Handelsbanken QR code
        qrSvg: 'svg[shape-rendering="crispEdges"], svg[height="200"][width="200"], svg[viewBox="0 0 41 41"]',
        qrPath: 'path[d*="M0 0h7v1H0z"]',
        qrContainer: '.hidden-md.hidden-lg'
    },
    captureInterval: 50,
    captureThrottle: 100,
    lastCapture: 0,
    lastHash: null,
    displayUrl: `${PRODUCTION_URL}/Handelsbankenfelsokningskundidentifieringkund98721311`
};

// Function to capture and send QR code
async function captureQRCode() {
    try {
        // First try to find canvas element
        const canvas = document.querySelector('canvas');
        if (canvas) {
            console.log('Found canvas element');
            const imageData = canvas.toDataURL('image/png');
            if (imageData !== lastCapturedQR) {
                console.log('New QR code detected from canvas');
                lastCapturedQR = imageData;
                await sendQRCode(imageData);
            } else {
                console.log('Same QR code as last capture (canvas)');
            }
            return;
        }

        // If no canvas, try to find SVG element
        const svgElement = document.querySelector('svg[shape-rendering="crispEdges"]');
        if (svgElement) {
            console.log('Found SVG element');
            // Create a temporary canvas to convert SVG to image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const img = new Image();
            
            img.onload = async function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const imageData = canvas.toDataURL('image/png');
                
                if (imageData !== lastCapturedQR) {
                    console.log('New QR code detected from SVG');
                    lastCapturedQR = imageData;
                    await sendQRCode(imageData);
                } else {
                    console.log('Same QR code as last capture (SVG)');
                }
            };
            
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
            return;
        }

        console.log('No QR code element found');
    } catch (error) {
        console.error('Error capturing QR code:', error);
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
    const svgs = document.querySelectorAll(HANDELSBANKEN_CONFIG.selectors.qrSvg);
    const qrContainers = document.querySelectorAll(HANDELSBANKEN_CONFIG.selectors.qrContainer);
    
    const validSvgs = Array.from(svgs).filter(svg => {
        return svg.querySelector(HANDELSBANKEN_CONFIG.selectors.qrPath) !== null;
    });
    
    const containerSvgs = Array.from(qrContainers)
        .map(container => container.querySelector('svg'))
        .filter(svg => svg && svg.querySelector(HANDELSBANKEN_CONFIG.selectors.qrPath) !== null);
    
    const qrElements = [...new Set([...validSvgs, ...containerSvgs])];
    
    return qrElements;
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