// Zeta QR Scanner Overlay - Draggable scanning window
// This creates a floating window that can be positioned over QR codes to scan them

(function() {
  'use strict';
  
  // Check if overlay already exists
  if (document.getElementById('zeta-scanner-overlay')) {
    console.log('[Zeta Scanner] Overlay already exists');
    return;
  }
  
  // Load jsQR if not available
  if (typeof jsQR === 'undefined' && typeof window.jsQR === 'undefined') {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('jsQR.min.js');
    script.onload = () => {
      initOverlay();
    };
    script.onerror = () => {
      // Try to get from window if content script loaded it
      setTimeout(() => {
        if (window.jsQR) {
          initOverlay();
        } else {
          console.error('[Zeta Scanner] Failed to load jsQR');
        }
      }, 500);
    };
    document.head.appendChild(script);
  } else {
    initOverlay();
  }
  
  // Helper to capture SVG elements to a canvas
  function captureSVGToCanvas(svg) {
    return new Promise((resolve, reject) => {
        try {
            const svgClone = svg.cloneNode(true);
            const rect = svg.getBoundingClientRect();
            const width = rect.width || 250;
            const height = rect.height || 250;

            svgClone.setAttribute('width', width);
            svgClone.setAttribute('height', height);
            if (!svgClone.getAttribute('xmlns')) {
              svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            }

            const svgData = new XMLSerializer().serializeToString(svgClone);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(url);
                resolve(canvas);
            };
            img.onerror = (err) => {
                URL.revokeObjectURL(url);
                reject(new Error('SVG could not be loaded into an image.'));
            };
            img.src = url;
        } catch (e) {
            reject(e);
        }
    });
  }

  function initOverlay() {
    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'zeta-scanner-overlay';
    overlay.innerHTML = `
      <div class="zeta-scanner-header">
        <span class="zeta-scanner-title">🎯 Zeta QR Scanner</span>
        <button class="zeta-scanner-close" id="zeta-scanner-close">×</button>
      </div>
      <div class="zeta-scanner-viewport" id="zeta-scanner-viewport">
        <canvas class="zeta-scanner-preview" id="zeta-scanner-preview" style="display: none;"></canvas>
        <div class="zeta-scanner-crosshair"></div>
        <div class="zeta-scanner-status" id="zeta-scanner-status">Position over QR code</div>
        <div class="zeta-scanner-help" id="zeta-scanner-help" style="display: none;">
          <div class="help-content">
            <h3>🎯 How to use:</h3>
            <p>1. Drag this window over a QR code</p>
            <p>2. Click "Scan Now" to start scanning</p>
            <p>3. The preview will show the captured QR</p>
            <p><strong>Tip:</strong> Works best with BankID QR codes!</p>
          </div>
        </div>
      </div>
      <div class="zeta-scanner-controls">
        <button class="zeta-scanner-btn" id="zeta-scanner-resize">Resize</button>
        <button class="zeta-scanner-btn" id="zeta-scanner-scan">Scan Now</button>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #zeta-scanner-overlay {
        position: fixed;
        top: 100px;
        left: 100px;
        width: 300px;
        height: 300px;
        background: rgba(0, 0, 0, 0.85);
        border: 3px solid #4ade80;
        border-radius: 12px;
        z-index: 999999;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        user-select: none;
        cursor: move;
      }
      
      .zeta-scanner-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 10px 15px;
        border-radius: 9px 9px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
      }
      
      .zeta-scanner-title {
        color: white;
        font-weight: bold;
        font-size: 14px;
      }
      
      .zeta-scanner-close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .zeta-scanner-close:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      .zeta-scanner-viewport {
        width: 100%;
        height: calc(100% - 100px);
        position: relative;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.3);
        border: 2px dashed rgba(74, 222, 128, 0.8);
      }
      
      .zeta-scanner-preview {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        max-width: 90%;
        max-height: 90%;
        border: 1px solid #4ade80;
        background: white;
      }
      
      .zeta-scanner-crosshair {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 200px;
        height: 200px;
        border: 2px dashed #4ade80;
        border-radius: 8px;
        pointer-events: none;
        box-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
        50% { opacity: 1; transform: translate(-50%, -50%) scale(1.02); }
        100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
      }
      
      .zeta-scanner-crosshair.scanning {
        border-color: #fbbf24;
        box-shadow: 0 0 20px rgba(251, 191, 36, 0.5);
        animation: scan 1s infinite;
      }
      
      .zeta-scanner-crosshair.found {
        border-color: #22c55e;
        box-shadow: 0 0 30px rgba(34, 197, 94, 0.8);
        animation: found 0.5s ease-out;
      }
      
      .zeta-scanner-crosshair.error {
        border-color: #ef4444;
        box-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
        animation: shake 0.5s ease-out;
      }
      
      @keyframes scan {
        0% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(0.95); }
        100% { transform: translate(-50%, -50%) scale(1); }
      }
      
      @keyframes found {
        0% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.1); }
        100% { transform: translate(-50%, -50%) scale(1); }
      }
      
      @keyframes shake {
        0%, 100% { transform: translate(-50%, -50%); }
        25% { transform: translate(-48%, -50%); }
        75% { transform: translate(-52%, -50%); }
      }
      
      .zeta-scanner-status {
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.7);
        color: #4ade80;
        padding: 8px 15px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: bold;
        white-space: nowrap;
        z-index: 10;
      }
      
      .zeta-scanner-help {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 20px;
        border-radius: 12px;
        border: 2px solid #4ade80;
        text-align: center;
        max-width: 250px;
        z-index: 5;
      }
      
      .help-content h3 {
        margin: 0 0 15px 0;
        color: #4ade80;
        font-size: 16px;
      }
      
      .help-content p {
        margin: 8px 0;
        font-size: 12px;
        line-height: 1.4;
      }
      
      .zeta-scanner-controls {
        padding: 10px;
        display: flex;
        gap: 10px;
        background: rgba(0, 0, 0, 0.5);
        border-radius: 0 0 9px 9px;
      }
      
      .zeta-scanner-btn {
        flex: 1;
        padding: 8px;
        background: #4ade80;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        font-size: 12px;
      }
      
      .zeta-scanner-btn:hover {
        background: #22c55e;
      }
      
      .zeta-scanner-btn:active {
        transform: scale(0.95);
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    
    // Make draggable
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    const header = overlay.querySelector('.zeta-scanner-header');
    
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    function dragStart(e) {
      if (e.target.classList.contains('zeta-scanner-close') || 
          e.target.classList.contains('zeta-scanner-btn')) {
        return;
      }
      
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      
      if (e.target === header || header.contains(e.target)) {
        isDragging = true;
      }
    }
    
    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        
        xOffset = currentX;
        yOffset = currentY;
        
        setTranslate(currentX, currentY, overlay);
      }
    }
    
    function dragEnd(e) {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
    }
    
    function setTranslate(xPos, yPos, el) {
      el.style.left = xPos + 'px';
      el.style.top = yPos + 'px';
      el.style.transform = 'none';
    }
    
    // Initialize position
    xOffset = 100;
    yOffset = 100;
    setTranslate(100, 100, overlay);
    
    // Close button
    overlay.querySelector('#zeta-scanner-close').addEventListener('click', () => {
      overlay.remove();
      style.remove();
    });
    
    // Resize functionality
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    overlay.querySelector('#zeta-scanner-resize').addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = parseInt(document.defaultView.getComputedStyle(overlay).width, 10);
      startHeight = parseInt(document.defaultView.getComputedStyle(overlay).height, 10);
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isResizing) {
        const width = startWidth + (e.clientX - startX);
        const height = startHeight + (e.clientY - startY);
        overlay.style.width = Math.max(200, width) + 'px';
        overlay.style.height = Math.max(200, height) + 'px';
      }
    });
    
    document.addEventListener('mouseup', () => {
      isResizing = false;
    });
    
    // Scan functionality
    const statusEl = overlay.querySelector('#zeta-scanner-status');
    const crosshair = overlay.querySelector('.zeta-scanner-crosshair');
    const helpEl = overlay.querySelector('#zeta-scanner-help');
    const previewCanvas = overlay.querySelector('#zeta-scanner-preview');
    let scanInterval = null;
    let failureCount = 0;
    
    // Visual feedback functions
    function setCrosshairState(state) {
      crosshair.className = 'zeta-scanner-crosshair ' + state;
    }
    
    function updateScannerFeedback(message, color, state = '') {
      statusEl.textContent = message;
      statusEl.style.color = color;
      setCrosshairState(state);
    }
    
    function showPreview(sourceCanvas) {
      // Show the captured QR in the preview canvas
      previewCanvas.style.display = 'block';
      previewCanvas.width = Math.min(sourceCanvas.width, 200);
      previewCanvas.height = Math.min(sourceCanvas.height, 200);
      
      const ctx = previewCanvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
      ctx.drawImage(sourceCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
      
      console.log('[Zeta Scanner] 📺 Showing QR preview:', previewCanvas.width, 'x', previewCanvas.height);
    }
    
    async function captureAndScan() {
        console.log('[Zeta DEBUG] 1. Starting captureAndScan...');
        updateScannerFeedback('Capturing screen area...', '#fbbf24', 'scanning');
        const viewportRect = overlay.querySelector('.zeta-scanner-viewport').getBoundingClientRect();
        console.log('[Zeta DEBUG] 2. Viewport Rect:', JSON.stringify(viewportRect));

        if (!viewportRect || viewportRect.width === 0 || viewportRect.height === 0) {
            console.error('[Zeta DEBUG] ERROR: Viewport is not visible or has zero dimensions.');
            updateScannerFeedback('Capture failed: Viewport not ready', '#ef4444', 'error');
            return;
        }

        try {
            const message = { 
                type: 'REQUEST_AREA_SCREENSHOT',
                rect: {
                    x: Math.round(viewportRect.left),
                    y: Math.round(viewportRect.top),
                    width: Math.round(viewportRect.width),
                    height: Math.round(viewportRect.height)
                }
            };
            console.log('[Zeta DEBUG] 3. Sending message to background:', JSON.stringify(message));
            
            // Request a screenshot of the specific area from the background script
            chrome.runtime.sendMessage(message, response => {
                console.log('[Zeta DEBUG] 5. Received response from background:', response);
                if (chrome.runtime.lastError) {
                    console.error('[Zeta DEBUG] ERROR in sendMessage callback:', chrome.runtime.lastError);
                    updateScannerFeedback(`Capture failed: ${chrome.runtime.lastError.message}`, '#ef4444', 'error');
                    return;
                }

                if (response && response.screenshot) {
                    console.log('[Zeta DEBUG] 6. Screenshot received. Length:', response.screenshot.length);
                    const img = new Image();
                    img.onload = () => {
                        console.log('[Zeta DEBUG] 7. Image loaded from screenshot data.');
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        canvas.getContext('2d').drawImage(img, 0, 0);
                        showPreview(canvas);
                        sendScreenshotToServer(response.screenshot);
                    };
                    img.onerror = () => {
                        console.error('[Zeta DEBUG] ERROR: Failed to load screenshot image data.');
                        updateScannerFeedback('Failed to load screenshot image', '#ef4444', 'error');
                    };
                    img.src = response.screenshot;
                } else {
                    const errorMessage = response ? response.error : 'No response or empty screenshot from background script.';
                    console.error('[Zeta DEBUG] ERROR: Failed to get screenshot:', errorMessage);
                    updateScannerFeedback(`Capture failed: ${errorMessage}`, '#ef4444', 'error');
                }
            });
            console.log('[Zeta DEBUG] 4. Message sent. Waiting for callback...');
        } catch (e) {
            console.error('[Zeta DEBUG] ERROR: Exception in captureAndScan:', e);
            updateScannerFeedback(`Capture failed: ${e.message}`, '#ef4444', 'error');
        }
    }

    function sendScreenshotToServer(imageData) {
      updateScannerFeedback('Sending to server...', '#fbbf24', 'scanning');
      
      const serverUrl = 'https://web-production-72c0d.up.railway.app';
      
      fetch(serverUrl + '/api/qr-decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          screenshot: imageData,
          source: 'scanner-overlay'
        }),
        mode: 'cors',
        credentials: 'omit'
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.success && data.qrData) {
          console.log('[Zeta Scanner] ✅ QR decoded by server!');
          updateScannerFeedback('✅ QR Found! (Scanning continues...)', '#4ade80', 'found');
          
          // Keep scanning - don't stop automatically
          // User must manually click "Stop Scan" to stop
        } else {
          updateScannerFeedback('No QR in image', '#ef4444', 'error');
        }
      })
      .catch(error => {
        console.error('[Zeta Scanner] Server error:', error);
        updateScannerFeedback('Server error', '#ef4444', 'error');
      });
    }
    
    function captureViewportFallback(viewportRect) {
      // Fallback: Try to use screen capture API or request screenshot from background
      tryScreenCapture(viewportRect);
    }
    
    function tryScreenCapture(viewportRect) {
      // This function is not fully implemented in the provided edit,
      // but the new code implies its existence.
      // For now, we'll just log a placeholder.
      console.log('[Zeta Scanner] Fallback to screen capture (not implemented)');
      // In a real scenario, you would use navigator.mediaDevices.getDisplayMedia()
      // or a screenshot library to capture the entire screen or a specific area.
      // This would require a different approach for the overlay's position.
    }
    
    function captureSVGToCanvas(svg, viewportRect) {
      return new Promise((resolve, reject) => {
        try {
          const svgClone = svg.cloneNode(true);
          const rect = svg.getBoundingClientRect();
          const width = rect.width || 250;
          const height = rect.height || 250;

          svgClone.setAttribute('width', width);
          svgClone.setAttribute('height', height);
          if (!svgClone.getAttribute('xmlns')) {
            svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          }

          const svgData = new XMLSerializer().serializeToString(svgClone);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);

          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve(canvas);
          };
          img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(new Error('SVG could not be loaded into an image.'));
          };
          img.src = url;
        } catch (e) {
          console.error('[Zeta Scanner] SVG capture error:', e);
          updateScannerFeedback('Error: ' + e.message, '#ef4444', 'error');
        }
      });
    }
    
    function scanCanvas(canvas, qrData = null) {
      // If QR data is already provided, use it
      if (qrData) {
        statusEl.textContent = '✅ QR Found! (Scanning continues...)';
        statusEl.style.color = '#4ade80';
        sendQRToServer(canvas.toDataURL('image/png'), qrData);
        // Keep scanning - don't stop automatically
        return;
      }
      
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Get jsQR from window (loaded by content script) or global
      const qrLib = (typeof window !== 'undefined' && window.jsQR) || 
                    (typeof jsQR !== 'undefined' ? jsQR : null);
      
      if (qrLib && typeof qrLib === 'function') {
        // Try multiple detection strategies
        let code = qrLib(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        
        if (!code) {
          code = qrLib(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
        }
        
        if (code && code.data) {
          statusEl.textContent = '✅ QR Found! (Scanning continues...)';
          statusEl.style.color = '#4ade80';
          
          // Send to server
          sendQRToServer(canvas.toDataURL('image/png'), code.data);
          
          // Keep scanning - don't stop automatically
        } else {
          statusEl.textContent = 'Scanning...';
          statusEl.style.color = '#fbbf24';
          // Debug: log pixel stats
          let nonWhite = 0;
          for (let i = 0; i < imageData.data.length; i += 4) {
            if (imageData.data[i] < 250 || imageData.data[i+1] < 250 || imageData.data[i+2] < 250) {
              nonWhite++;
            }
          }
          console.log('[Zeta Scanner] No QR found. Canvas:', canvas.width, 'x', canvas.height, 'Non-white pixels:', nonWhite);
        }
      } else {
        statusEl.textContent = 'jsQR not loaded';
        statusEl.style.color = '#ef4444';
        console.error('[Zeta Scanner] jsQR library not available. window.jsQR:', typeof window.jsQR);
      }
    }
    
    function sendQRToServer(imageData, qrData) {
      const serverUrl = 'https://web-production-72c0d.up.railway.app';
      
      fetch(serverUrl + '/api/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrData: imageData,
          qrString: qrData,
          timestamp: Date.now(),
          source: 'scanner-overlay'
        }),
        mode: 'cors'
      }).then(response => {
        if (response.ok) {
          statusEl.textContent = '✅ Sent to server!';
          console.log('[Zeta Scanner] QR sent successfully');
        }
      }).catch(err => {
        console.error('[Zeta Scanner] Send error:', err);
        statusEl.textContent = '❌ Send failed';
        statusEl.style.color = '#ef4444';
      });
    }
    
    // Start/stop scanning
    overlay.querySelector('#zeta-scanner-scan').addEventListener('click', () => {
      if (scanInterval) {
        // Stop scanning
        clearInterval(scanInterval);
        scanInterval = null;
        overlay.querySelector('#zeta-scanner-scan').textContent = 'Scan Now';
        updateScannerFeedback('Scanning stopped', '#ffffff', '');
        previewCanvas.style.display = 'none'; // Hide preview when stopped
      } else {
        // Start scanning
        scanInterval = setInterval(() => {
          try {
            captureAndScan();
          } catch (err) {
            console.error('[Zeta Scanner] Uncaught scan error:', err);
            updateScannerFeedback('Critical Scan Error', '#ef4444', 'error');
          }
        }, 1000);
        overlay.querySelector('#zeta-scanner-scan').textContent = 'Stop Scan';
        updateScannerFeedback('Scanning...', '#fbbf24', 'scanning');
        captureAndScan(); // Immediate scan
      }
    });
    
    console.log('[Zeta Scanner] Overlay created and ready');
  }
})();

