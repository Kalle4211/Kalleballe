// ZETA ENHANCED QR SCANNER - MAXIMUM POWER VERSION
// Enhanced Content Script for Railway Server with advanced stability features

// Prevent multiple executions
if (window.ZETA_QR_SCANNER_LOADED) {
  console.log('[Zeta QR] Script already loaded, skipping...');
} else {
  window.ZETA_QR_SCANNER_LOADED = true;

// Server configuration - using different variable name to avoid conflicts
const ZETA_RAILWAY_SERVER = 'https://web-production-72c0d.up.railway.app';
let lastQR = null;
let consecutiveFailures = 0;
let isConnected = true;
let scanInterval = 2000;
let retryTimeout = null;

// Safe message sending with error handling
function safeSendMessage(message) {
  try {
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(message).catch(err => {
        console.log('[Zeta QR] ⚠️ Background message failed:', err);
      });
    }
  } catch (error) {
    console.log('[Zeta QR] ⚠️ Extension context error:', error);
  }
}

// Enhanced QR detection with multiple methods
function scanForQR() {
  const jsQR = window.jsQR;
  if (!jsQR) return;

  scanCanvasElements();
  scanImageElements();
}

function scanCanvasElements() {
  const canvases = document.querySelectorAll('canvas');
  for (const canvas of canvases) {
    if (!canvas.width || !canvas.height) continue;
    
    // Check if canvas is square (likely QR code)
    const isSquare = Math.abs(canvas.width - canvas.height) < 5;
    const hasValidSize = canvas.width >= 100 && canvas.width <= 500;
    
    if (!isSquare && !hasValidSize) continue;
    
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data && code.data !== lastQR) {
        console.log('[Zeta QR] ✅ Found QR in canvas on', window.location.hostname);
        handleQRFound(code.data, canvas.toDataURL('image/png'));
      }
    } catch (e) {
      // CORS or other canvas errors - skip
      // Use scanner overlay for problematic canvases
    }
  }
}

function scanImageElements() {
  const images = document.querySelectorAll('img');
  
  for (const img of images) {
    if (!img.complete || !img.naturalWidth) continue;
    
    // Check if image might be a QR code (square, reasonable size)
    const rect = img.getBoundingClientRect();
    const isSquare = Math.abs(rect.width - rect.height) < 10;
    const hasReasonableSize = rect.width >= 100 && rect.width <= 500;
    
    if (!isSquare && !hasReasonableSize) continue;
    
    try {
      const canvas = document.createElement('canvas');
      const width = img.naturalWidth || rect.width || img.width || 200;
      const height = img.naturalHeight || rect.height || img.height || 200;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data && code.data !== lastQR) {
        console.log('[Zeta QR] ✅ Found QR in image on', window.location.hostname);
        handleQRFound(code.data, canvas.toDataURL('image/png'));
      }
    } catch (e) {
      // CORS error - skip
      // Use scanner overlay for problematic images
    }
  }
}

// SVG scanning disabled - use scanner overlay instead
// This function is kept but won't be called automatically
function scanSVGElements() {
  // SVG scanning removed from automatic scanning
  // Use the scanner overlay window for SVG QR codes instead
  return;
}

function scanSingleSVG(svg, isScriveSite) {
  try {
    // Check if SVG might be a QR code (square, reasonable size)
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.getAttribute('viewBox');
    let width = svg.getAttribute('width');
    let height = svg.getAttribute('height');
    
    // Parse viewBox if dimensions not set (format: "0 0 265 265")
    if (!width && viewBox) {
      const vbParts = viewBox.split(/\s+/);
      if (vbParts.length >= 4) {
        width = vbParts[2];
        height = vbParts[3];
      }
    }
    
    // Fallback to computed dimensions
    if (!width || width === '0' || !height || height === '0') {
      width = rect.width || 300;
      height = rect.height || 300;
    }
    
    const widthNum = parseFloat(width);
    const heightNum = parseFloat(height);
    
    // For scrive sites, be more aggressive - check any square SVG
    const isSquare = Math.abs(widthNum - heightNum) < 5 || 
                    Math.abs(rect.width - rect.height) < 10;
    const hasReasonableSize = (widthNum >= 50 && widthNum <= 1000) ||
                             (rect.width >= 50 && rect.width <= 1000);
    
    // Skip if clearly not a QR code
    if (!isSquare && !isScriveSite) {
      return;
    }
    
    if (isScriveSite && isSquare && (rect.width >= 50 || widthNum >= 50)) {
      console.log('[Zeta QR] 🔍 Found potential QR SVG:', widthNum, 'x', heightNum, 'rect:', rect.width, 'x', rect.height);
    }
    
    // Clone SVG to avoid modifying original
    const svgClone = svg.cloneNode(true);
    
    // Ensure SVG has explicit dimensions for rendering - use viewBox dimensions if available
    const finalWidth = widthNum || 300;
    const finalHeight = heightNum || 300;
    
    svgClone.setAttribute('width', finalWidth);
    svgClone.setAttribute('height', finalHeight);
    
    // Preserve viewBox if it exists
    if (viewBox && !svgClone.getAttribute('viewBox')) {
      svgClone.setAttribute('viewBox', viewBox);
    }
    
    // For scrive QR codes, ensure proper rendering
    if (isScriveSite && finalWidth === 205 && finalHeight === 205) {
      // Ensure SVG has proper namespace and styling
      if (!svgClone.getAttribute('xmlns')) {
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
      // Ensure paths are visible (black on white)
      const paths = svgClone.querySelectorAll('path');
      paths.forEach(path => {
        if (!path.getAttribute('stroke') && !path.getAttribute('fill')) {
          path.setAttribute('stroke', '#000000');
          path.setAttribute('fill', 'none');
        }
      });
    }
    
    const svgData = new XMLSerializer().serializeToString(svgClone);
    
    // Create data URL with proper encoding
    const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(svgBlob);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = new Image();
    
    // Set canvas size - use larger size for better QR detection
    // For scrive sites, use at least 400px for better resolution
    const minSize = isScriveSite ? 400 : 300;
    const canvasSize = Math.max(finalWidth, finalHeight, minSize);
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    // Ensure white background for QR codes
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    let timeoutId = null;
    let scanned = false; // Prevent duplicate scans
    
    // Define onload handler
    const onloadHandler = () => {
      if (scanned) return;
      try {
        if (timeoutId) clearTimeout(timeoutId);
        scanned = true;
        
        // Draw SVG to fill canvas (white background already set)
        // For 205x205 QR codes, draw at full size
        if (isScriveSite && finalWidth === 205 && finalHeight === 205) {
          // This is the QR code - draw it large to preserve detail
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } else {
          // Scale to fit while maintaining aspect ratio
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
          const x = (canvas.width - img.width * scale) / 2;
          const y = (canvas.height - img.height * scale) / 2;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        }
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Try multiple QR detection strategies
      let code = null;
      
      // Strategy 1: Normal detection
      code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });
      
      if (!code && isScriveSite) {
        // Strategy 2: Try with inversion
        code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
      }
      
      if (!code && isScriveSite) {
        // Strategy 3: Try larger canvas for better resolution
        const largerCanvas = document.createElement('canvas');
        const largerSize = Math.max(canvasSize * 2, 600);
        largerCanvas.width = largerSize;
        largerCanvas.height = largerSize;
        const largerCtx = largerCanvas.getContext('2d');
        largerCtx.drawImage(img, 0, 0, largerSize, largerSize);
        const largerImageData = largerCtx.getImageData(0, 0, largerSize, largerSize);
        code = jsQR(largerImageData.data, largerImageData.width, largerImageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        
        if (code) {
          console.log('[Zeta QR] ✅ Found QR with larger canvas');
          canvas = largerCanvas;
        }
      }
      
      if (code && code.data && code.data !== lastQR) {
        console.log('[Zeta QR] ✅ Found QR in SVG on', window.location.hostname, '- Data:', code.data.substring(0, 50) + '...');
        handleQRFound(code.data, canvas.toDataURL('image/png'));
      } else if (isScriveSite) {
        console.log('[Zeta QR] ⚠️ SVG scanned but no QR found. Canvas size:', canvas.width, 'x', canvas.height, 'SVG size:', finalWidth, 'x', finalHeight);
        
        // Debug: Check image data quality
        let nonWhitePixels = 0;
        let blackPixels = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          if (r < 250 || g < 250 || b < 250) nonWhitePixels++;
          if (r < 50 && g < 50 && b < 50) blackPixels++;
        }
        console.log('[Zeta QR] 🔍 Image data stats - Non-white pixels:', nonWhitePixels, 'Black pixels:', blackPixels, 'Total pixels:', imageData.data.length / 4);
        
        // Try alternative method as fallback (only if we have some non-white pixels)
        if (nonWhitePixels > 100) {
          console.log('[Zeta QR] 🔄 Trying alternative rendering method...');
          setTimeout(() => {
            tryAlternativeSVGRender(svg, rect);
          }, 100);
        } else {
          console.log('[Zeta QR] ⚠️ Image appears to be blank or all white - SVG may not have rendered correctly');
        }
      }
      } catch (e) {
        console.log('[Zeta QR] SVG render error:', e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    
    // Define error handler
    const onerrorHandler = () => {
      if (scanned) return;
      if (timeoutId) clearTimeout(timeoutId);
      console.log('[Zeta QR] SVG image load error, trying alternative method');
      URL.revokeObjectURL(url);
      
      // For scrive sites, try alternative rendering method
      if (isScriveSite) {
        tryAlternativeSVGRender(svg, rect);
      }
    };
    
    img.onload = onloadHandler;
    img.onerror = onerrorHandler;
    
    // Set timeout for scrive sites - force load if needed
    if (isScriveSite) {
      timeoutId = setTimeout(() => {
        if (!img.complete || img.naturalWidth === 0) {
          console.log('[Zeta QR] SVG load timeout, trying alternative');
          URL.revokeObjectURL(url);
          tryAlternativeSVGRender(svg, rect);
        }
      }, 500);
    }
    
    img.src = url;
  } catch (e) {
    console.log('[Zeta QR] scanSingleSVG error:', e);
    if (isScriveSite) {
      const rect = svg.getBoundingClientRect();
      tryAlternativeSVGRender(svg, rect);
    }
  }
}

// Alternative SVG rendering method for scrive.com
function tryAlternativeSVGRender(svg, rect) {
  try {
    console.log('[Zeta QR] 🔄 Trying alternative SVG render method');
    
    // Try using foreignObject to render SVG directly to canvas
    const canvas = document.createElement('canvas');
    const size = Math.max(rect.width || 400, 400);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Clone SVG and set explicit size
    const svgClone = svg.cloneNode(true);
    const viewBox = svg.getAttribute('viewBox');
    let width = svg.getAttribute('width');
    let height = svg.getAttribute('height');
    
    if (!width && viewBox) {
      const vbParts = viewBox.split(/\s+/);
      if (vbParts.length >= 4) {
        width = vbParts[2];
        height = vbParts[3];
      }
    }
    
    const finalWidth = parseFloat(width) || 400;
    const finalHeight = parseFloat(height) || 400;
    
    svgClone.setAttribute('width', finalWidth);
    svgClone.setAttribute('height', finalHeight);
    if (viewBox) {
      svgClone.setAttribute('viewBox', viewBox);
    }
    
    // Ensure proper SVG namespace
    if (!svgClone.getAttribute('xmlns')) {
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    
    // For 205x205 QR codes, ensure paths are properly styled for rendering
    if (finalWidth === 205 && finalHeight === 205) {
      const paths = svgClone.querySelectorAll('path');
      console.log('[Zeta QR] 🔍 Found', paths.length, 'paths in QR SVG');
      paths.forEach(path => {
        // Ensure stroke is black and visible
        const stroke = path.getAttribute('stroke');
        const strokeWidth = path.getAttribute('stroke-width');
        if (!stroke || stroke === 'none') {
          path.setAttribute('stroke', '#000000');
        }
        if (!strokeWidth || parseFloat(strokeWidth) < 1) {
          path.setAttribute('stroke-width', '5');
        }
        // Ensure fill doesn't interfere
        if (!path.getAttribute('fill') || path.getAttribute('fill') === 'none') {
          path.setAttribute('fill', 'none');
        }
      });
    }
    
    // Create SVG data URL
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    
    img.onload = () => {
      try {
        // Draw at multiple sizes to find the best one
        const sizes = [size, size * 1.5, size * 2, 600, 800];
        
        for (const testSize of sizes) {
          const testCanvas = document.createElement('canvas');
          testCanvas.width = testSize;
          testCanvas.height = testSize;
          const testCtx = testCanvas.getContext('2d');
          
          // White background
          testCtx.fillStyle = '#FFFFFF';
          testCtx.fillRect(0, 0, testSize, testSize);
          
          // Draw SVG
          testCtx.drawImage(img, 0, 0, testSize, testSize);
          
          const imageData = testCtx.getImageData(0, 0, testSize, testSize);
          
          // Try normal
          let code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          
          // Try inverted
          if (!code) {
            code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });
          }
          
          if (code && code.data && code.data !== lastQR) {
            console.log('[Zeta QR] ✅ Found QR via alternative method at size', testSize);
            handleQRFound(code.data, testCanvas.toDataURL('image/png'));
            URL.revokeObjectURL(url);
            return;
          }
        }
        
        console.log('[Zeta QR] ⚠️ Alternative method tried all sizes, no QR found');
        URL.revokeObjectURL(url);
      } catch (e) {
        console.log('[Zeta QR] Alternative render error:', e);
        URL.revokeObjectURL(url);
      }
    };
    
    img.onerror = () => {
      console.log('[Zeta QR] Alternative method image load failed');
      URL.revokeObjectURL(url);
    };
    
    img.src = url;
  } catch (e) {
    console.log('[Zeta QR] Alternative SVG render failed:', e);
  }
}

function scanVideoElements() {
  const videos = document.querySelectorAll('video');
  for (const video of videos) {
    if (video.readyState < 2) continue; // not enough data
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data && code.data !== lastQR) {
        handleQRFound(code.data, canvas.toDataURL('image/png'));
      }
    } catch (e) {
      // ignore video errors
    }
  }
}

function scanIframeElements() {
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    try {
      if (iframe.contentDocument) {
        const iframeImages = iframe.contentDocument.querySelectorAll('img');
        for (const img of iframeImages) {
          if (!img.complete || !img.naturalWidth) continue;
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data && code.data !== lastQR) {
            handleQRFound(code.data, canvas.toDataURL('image/png'));
          }
        }
      }
    } catch (e) {
      // ignore iframe errors (cross-origin)
    }
  }
}

function handleQRFound(qrData, base64Image) {
  // FINAL GUARD: Never send the test QR string.
  if (!qrData || qrData.includes('TEST_QR_FROM_ZETA')) {
    console.log('[Zeta QR] 🚫 Ignored test or invalid QR data.');
    return;
  }
  lastQR = qrData;
  console.log('[Zeta QR] 🔥 FOUND QR CODE:', qrData.substring(0, 100));
  
  // Reset failure counter on success
  consecutiveFailures = 0;
  scanInterval = Math.max(1000, scanInterval - 100); // Speed up on success
  
  // Notify background script safely
  safeSendMessage({
    type: 'QR_FOUND',
    qrData: qrData.substring(0, 100),
    timestamp: Date.now()
  });
  
  sendQRToServer(base64Image, qrData);
}

// Enhanced server communication with retry logic
function sendQRToServer(base64Image, qrString = null) {
  const payload = {
    qrData: base64Image,
    qrString: qrString,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    url: window.location.href
  };

  console.log('[Zeta QR] 📤 Sending QR to server...');
  console.log('[Zeta QR] 📊 Payload size:', JSON.stringify(payload).length, 'bytes');
  console.log('[Zeta QR] 🔗 Server URL:', ZETA_RAILWAY_SERVER + '/api/qr');

  fetch(ZETA_RAILWAY_SERVER + '/api/qr', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    mode: 'cors',
    credentials: 'omit'
  })
  .then(async response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const respText = await response.text();
    console.log('[Zeta QR] ✅ Server response:', respText);
    
    // Success - reset everything
    consecutiveFailures = 0;
    isConnected = true;
    scanInterval = 2000;
    
    // Notify background script of success safely
    safeSendMessage({
      type: 'QR_SENT_SUCCESS',
      timestamp: Date.now()
    });
    
    // Clear any pending retry
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
  })
  .catch(error => {
    console.log('[Zeta QR] ❌ Server error:', error);
    console.log('[Zeta QR] 🔍 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    consecutiveFailures++;
    
    // Notify background script of failure safely
    safeSendMessage({
      type: 'QR_SENT_FAILED',
      error: error.message,
      timestamp: Date.now()
    });
    
    // Adaptive retry logic
    if (consecutiveFailures >= 3) {
      isConnected = false;
      scanInterval = Math.min(10000, scanInterval + 1000); // Slow down on failures
    }
    
    // Retry with exponential backoff
    if (retryTimeout) clearTimeout(retryTimeout);
    retryTimeout = setTimeout(() => {
      console.log('[Zeta QR] 🔄 Retrying...');
      sendQRToServer(base64Image, qrString);
    }, Math.min(30000, 1000 * Math.pow(2, consecutiveFailures)));
  });
}

// Connection health check
function checkConnection() {
  console.log('[Zeta QR] 🔍 Checking server connection...');
  fetch(ZETA_RAILWAY_SERVER + '/health', { 
    method: 'GET',
    mode: 'cors',
    credentials: 'omit'
  })
    .then(response => {
      if (response.ok) {
        isConnected = true;
        consecutiveFailures = 0;
        console.log('[Zeta QR] ✅ Server connection healthy');
        return response.json();
      } else {
        throw new Error(`Health check failed: ${response.status}`);
      }
    })
    .then(data => {
      console.log('[Zeta QR] 📊 Server status:', data);
    })
    .catch(error => {
      console.log('[Zeta QR] ❌ Server health check failed:', error);
      isConnected = false;
    });
}

// Enhanced scanning with adaptive intervals
function startScanning() {
  if (!isConnected) {
    console.log('[Zeta QR] ⚠️ Server disconnected, slowing down...');
    scanInterval = 10000;
  }
  
  scanForQR();
  
  // Adaptive interval based on connection status
  setTimeout(startScanning, scanInterval);
}

// Initialize everything with error handling
try {
  console.log('[Zeta QR] 🚀 ENHANCED SCANNER INITIALIZED');
  console.log('[Zeta QR] Target server:', ZETA_RAILWAY_SERVER);
  console.log('[Zeta QR] Extension ID:', chrome.runtime?.id || 'unknown');
  console.log('[Zeta QR] Page URL:', window.location.href);

  // Start health checks every 30 seconds
  setInterval(checkConnection, 30000);

  // Initial health check
  checkConnection();

  // Test server connection with dummy QR after 5 seconds - REMOVED
  /*
  setTimeout(() => {
    console.log('[Zeta QR] 🧪 Testing server connection with dummy QR...');
    sendQRToServer('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'TEST_QR_FROM_ZETA');
  }, 5000);
  */

  // For scrive.com/BankID sites, scan more frequently
  const isScriveSiteInit = window.location.href.includes('scrive.com') || 
                      window.location.href.includes('eid.') ||
                      document.title.toLowerCase().includes('bankid');
  
  if (isScriveSiteInit) {
    console.log('[Zeta QR] 🎯 Scrive/BankID site detected - using aggressive scanning');
    scanInterval = 500; // Scan every 500ms for BankID sites
    
    // Wait for page to fully load (SPA content might load after initial HTML)
    // Check for spinner to disappear or wait a bit
    const waitForContent = () => {
      const spinner = document.querySelector('.spinner-border, .spinner, [role="status"]');
      const hasContent = document.querySelector('svg, canvas, img[alt*="QR"], button[aria-label*="QR"]');
      
      if (hasContent || !spinner) {
        console.log('[Zeta QR] ✅ Content loaded, starting aggressive scan');
        startScanning();
        
        // Also do immediate scan
        setTimeout(() => scanForQR(), 100);
        setTimeout(() => scanForQR(), 500);
        setTimeout(() => scanForQR(), 1000);
      } else {
        console.log('[Zeta QR] ⏳ Waiting for content to load...');
        setTimeout(waitForContent, 500);
      }
    };
    
    // Start waiting for content
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', () => {
        setTimeout(waitForContent, 1000); // Give JS time to render
      });
    } else {
      setTimeout(waitForContent, 1000); // Already loaded, but wait for JS to render
    }
  } else {
    // Start scanning immediately for non-scrive sites
    startScanning();
  }

  // Listen for page changes (SPA support)
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('[Zeta QR] 📄 Page changed, resetting scanner');
      lastQR = null; // Reset QR cache on page change
    }
  });
  
  observer.observe(document, {
    subtree: true, 
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'style', 'class'] // Watch for QR code appearance
  });

} catch (error) {
  console.log('[Zeta QR] ❌ Initialization error:', error);
}

} // End of ZETA_QR_SCANNER_LOADED check 