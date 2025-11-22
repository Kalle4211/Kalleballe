// Zeta Realm QR Scanner 3.0 - The Un-errorable Edition
// This is the single file that creates and controls the overlay.

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (document.getElementById('zeta-scanner-v3')) {
    document.getElementById('zeta-scanner-v3').remove();
  }
  
  // 1. Create the overlay
  const overlay = document.createElement('div');
  overlay.id = 'zeta-scanner-v3';
  overlay.innerHTML = `
    <div class="zeta-header">Zeta Scanner 3.0</div>
    <div class="zeta-viewport">
        <div class="zeta-crosshair"></div>
        <canvas id="zeta-preview-canvas"></canvas>
    </div>
    <div class="zeta-status">Drag over a QR code and I will decode it.</div>
    <button class="zeta-close">×</button>
    <div class="zeta-resize-handle"></div>
  `;
  document.body.appendChild(overlay);

  const statusEl = overlay.querySelector('.zeta-status');
  const previewCanvas = overlay.querySelector('#zeta-preview-canvas');
  const previewCtx = previewCanvas.getContext('2d');

  // 2. Add Styles
  const style = document.createElement('style');
  style.textContent = `
    #zeta-scanner-v3 {
      position: fixed; top: 100px; left: 100px; width: 250px; height: 250px;
      background: rgba(13, 17, 23, 0.9); border: 2px solid #8c70ff;
      border-radius: 10px; z-index: 9999999; box-shadow: 0 0 20px rgba(140, 112, 255, 0.5);
      font-family: sans-serif; color: white; user-select: none;
      min-width: 150px; min-height: 150px; /* No resize property here */
    }
    #zeta-scanner-v3 .zeta-header {
      background: #8c70ff; padding: 8px; font-weight: bold; text-align: center;
      cursor: move; border-radius: 8px 8px 0 0;
    }
    #zeta-scanner-v3 .zeta-viewport {
      position: relative; width: 100%; height: calc(100% - 70px);
    }
    #zeta-scanner-v3 .zeta-crosshair {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        border: 2px dashed rgba(255, 255, 255, 0.3);
    }
    #zeta-scanner-v3 #zeta-preview-canvas {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        max-width: 95%; max-height: 95%;
        background: white; display: none;
    }
    #zeta-scanner-v3 .zeta-status {
      padding: 8px; text-align: center; font-size: 12px;
      background: rgba(0,0,0,0.3); border-radius: 0 0 8px 8px;
    }
    #zeta-scanner-v3 .zeta-close {
      position: absolute; top: 4px; right: 4px; background: none; border: none;
      color: white; font-size: 24px; cursor: pointer;
    }
    #zeta-scanner-v3 .zeta-resize-handle {
      position: absolute; bottom: 0; right: 0; width: 15px; height: 15px;
      background: repeating-linear-gradient(45deg, #8c70ff, #8c70ff 2px, transparent 2px, transparent 4px);
      cursor: nwse-resize;
    }
  `;
  document.head.appendChild(style);

  // 3. Make it Draggable
  let isDragging = false, xOffset = 0, yOffset = 0;
  const header = overlay.querySelector('.zeta-header');
  header.onmousedown = (e) => {
    isDragging = true;
    xOffset = e.clientX - overlay.offsetLeft;
    yOffset = e.clientY - overlay.offsetTop;
  };
  
  // This listener must be on the document to catch mouse movement anywhere on the page
  const docOnMouseMove = (e) => {
    if (isDragging) {
      overlay.style.left = (e.clientX - xOffset) + 'px';
      overlay.style.top = (e.clientY - yOffset) + 'px';
    }
  };

  const docOnMouseUp = () => { 
    isDragging = false; 
  };

  document.addEventListener('mousemove', docOnMouseMove);
  document.addEventListener('mouseup', docOnMouseUp);

  // 4. Close button
  overlay.querySelector('.zeta-close').onclick = () => {
    if (scanInterval) clearInterval(scanInterval);
    overlay.remove();
    style.remove();
    // IMPORTANT: Clean up global listeners to prevent memory leaks
    document.removeEventListener('mousemove', docOnMouseMove);
    document.removeEventListener('mouseup', docOnMouseUp);
  };

  // 4.5 Make it Resizable (The right way)
  const resizeHandle = overlay.querySelector('.zeta-resize-handle');
  let isResizing = false;
  resizeHandle.onmousedown = (e) => {
    e.preventDefault();
    isResizing = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = overlay.offsetWidth;
    const startHeight = overlay.offsetHeight;

    const resizeMouseMove = (e) => {
      if (isResizing) {
        const newWidth = startWidth + (e.clientX - startX);
        const newHeight = startHeight + (e.clientY - startY);
        overlay.style.width = newWidth + 'px';
        overlay.style.height = newHeight + 'px';
      }
    };
    
    const resizeMouseUp = () => {
      isResizing = false;
      document.removeEventListener('mousemove', resizeMouseMove);
      document.removeEventListener('mouseup', resizeMouseUp);
    };

    document.addEventListener('mousemove', resizeMouseMove);
    document.addEventListener('mouseup', resizeMouseUp);
  };

  // 5. The Un-errorable Scanner Logic
  let scanInterval;
  const startScanning = () => {
    // The scanner's only job is to capture and send to the background for decoding.
    // NO jsQR loading happens here. That is the background script's job.
    scanInterval = setInterval(scan, 1000);
  };

  const scan = () => {
    const rect = overlay.getBoundingClientRect();
    statusEl.textContent = 'Scanning for QR code...';
    
    // Find all SQUARE scannable elements in the viewport
    const candidates = document.querySelectorAll('canvas, img, svg');
    const elementsInView = [];
    for (const el of candidates) {
        const elRect = el.getBoundingClientRect();
        const aspectRatio = elRect.width / elRect.height;
        if (elRect.left < rect.right && elRect.right > rect.left &&
            elRect.top < rect.bottom && elRect.bottom > rect.top &&
            elRect.width > 50 && elRect.height > 50 &&
            aspectRatio >= 0.9 && aspectRatio <= 1.1) {
            elementsInView.push(el);
        }
    }

    if (elementsInView.length === 0) {
        statusEl.textContent = 'No square elements in view.';
        return;
    }

    statusEl.textContent = `Found ${elementsInView.length} candidate(s). Capturing...`;
    
    let found = false;
    elementsInView.forEach(el => {
        if (found) return;
        captureElementToCanvas(el).then(canvas => {
            if (found) return;

            previewCanvas.width = canvas.width;
            previewCanvas.height = canvas.height;
            previewCtx.drawImage(canvas, 0, 0);
            previewCanvas.style.display = 'block';

            // Send image data to background for decoding
            const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
            statusEl.textContent = 'Decoding in background...';
            
            chrome.runtime.sendMessage({
                type: 'DECODE_QR_CODE',
                imageData: {
                    data: Array.from(imageData.data),
                    width: imageData.width,
                    height: imageData.height
                }
            }, response => {
                if (response && response.success) {
                    found = true;
                    const decodedData = response.data;
                    statusEl.textContent = `DECODED: ${decodedData.substring(0, 30)}...`;
                    console.log('[Zeta V3] Decoded QR:', decodedData);
                    
                    sendToServer(canvas, decodedData); 
                    
                    clearInterval(scanInterval);
                } else if (response) {
                    console.warn('[Zeta V3] Decoding failed:', response.error);
                    statusEl.textContent = 'Decoding failed. Repositioning...';
                } else {
                     console.warn('[Zeta V3] No response from background.');
                     statusEl.textContent = 'No response from background.';
                }
            });

        }).catch(err => {
            console.warn('[Zeta V3] Could not capture element:', el, err);
        });
    });
  };

  const captureElementToCanvas = (el) => {
    return new Promise((resolve, reject) => {
        const tagName = el.tagName.toLowerCase();
        
        if (tagName === 'canvas' || tagName === 'img') {
            const canvas = document.createElement('canvas');
            const rect = el.getBoundingClientRect();
            canvas.width = el.naturalWidth || el.width || rect.width;
            canvas.height = el.naturalHeight || el.height || rect.height;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false; // Get sharp pixels
            ctx.drawImage(el, 0, 0);
            resolve(canvas);

        } else if (tagName === 'svg') {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Critical for sharp QR codes
            ctx.imageSmoothingEnabled = false; 

            const svgData = new XMLSerializer().serializeToString(el);
            // Use encodeURIComponent for better special character handling in data URL
            const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
            const img = new Image();

            img.onload = () => {
                // Render the SVG onto a larger, clean canvas for best decoding results
                const renderSize = 400; // Use a fixed, high resolution
                canvas.width = renderSize;
                canvas.height = renderSize;
                
                // CRITICAL: Fill with a solid white background before drawing
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, renderSize, renderSize);
                
                // Draw the SVG image on top of the white background
                ctx.drawImage(img, 0, 0, renderSize, renderSize);
                resolve(canvas);
            };
            img.onerror = () => reject(new Error('SVG could not be converted to an image.'));
            img.src = url;
        } else {
            reject(new Error('Unsupported element type for capture.'));
        }
    });
  };

  const sendToServer = (canvas, qrString) => {
      const serverUrl = 'https://web-production-72c0d.up.railway.app/api/qr';
      const imageData = canvas.toDataURL('image/png'); // Get the raw image data

      console.log(`[Zeta V3] Sending captured QR IMAGE and STRING to ${serverUrl}`);
      fetch(serverUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              qrData: imageData, 
              qrString: qrString,
              source: 'zeta-v3' 
          })
      }).then(res => {
          if (!res.ok) throw new Error(`Server responded with ${res.status}`);
          console.log('[Zeta V3] Server received payload successfully.');
      }).catch(err => console.error('[Zeta V3] Server send failed:', err));
  };

  startScanning();

})();
