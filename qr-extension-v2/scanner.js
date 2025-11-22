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
  document.onmousemove = (e) => {
    if (isDragging) {
      overlay.style.left = (e.clientX - xOffset) + 'px';
      overlay.style.top = (e.clientY - yOffset) + 'px';
    }
  };
  document.onmouseup = () => { isDragging = false; };

  // 4. Close button
  overlay.querySelector('.zeta-close').onclick = () => {
    overlay.remove();
    style.remove();
  };

  // 5. The Un-errorable Scanner Logic
  let scanInterval;
  const startScanning = () => {
    // Inject jsQR if it's not already on the page
    if (typeof jsQR === 'undefined') {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('jsQR.min.js');
        document.head.appendChild(script);
        script.onload = () => {
            console.log('[Zeta V3] jsQR loaded.');
            scanInterval = setInterval(scan, 500);
        };
    } else {
        scanInterval = setInterval(scan, 500);
    }
  };

  const scan = () => {
    const rect = overlay.getBoundingClientRect();
    statusEl.textContent = 'Scanning...';
    
    // Shotgun approach: find all scannable elements in the viewport
    const candidates = document.querySelectorAll('canvas, img, svg');
    const elementsInView = [];
    for (const el of candidates) {
        const elRect = el.getBoundingClientRect();
        // Check for intersection with overlay
        if (elRect.left < rect.right && elRect.right > rect.left &&
            elRect.top < rect.bottom && elRect.bottom > rect.top &&
            elRect.width > 50 && elRect.height > 50) {
            elementsInView.push(el);
        }
    }

    if (elementsInView.length === 0) {
        statusEl.textContent = 'No scannable elements in view.';
        return;
    }

    statusEl.textContent = `Found ${elementsInView.length} candidates. Decoding...`;
    
    // Try to decode every single candidate
    let found = false;
    for (const el of elementsInView) {
        if (found) break;

        captureElementToCanvas(el).then(canvas => {
            if (found) return; // Another element was decoded first

            const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code && code.data) {
                found = true;
                statusEl.textContent = `DECODED: ${code.data.substring(0, 30)}...`;
                console.log('[Zeta V3] Decoded QR:', code.data);
                
                // Show the successful canvas in the preview
                previewCanvas.width = canvas.width;
                previewCanvas.height = canvas.height;
                previewCtx.drawImage(canvas, 0, 0);
                previewCanvas.style.display = 'block';

                sendToServer(code.data);
                clearInterval(scanInterval); // Stop on success
            }
        }).catch(err => {
            console.warn('[Zeta V3] Could not capture or process element:', el, err);
        });
    }
  };

  const captureElementToCanvas = (el) => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const tagName = el.tagName.toLowerCase();
        
        if (tagName === 'canvas' || tagName === 'img') {
            const rect = el.getBoundingClientRect();
            canvas.width = el.naturalWidth || rect.width;
            canvas.height = el.naturalHeight || rect.height;
            canvas.getContext('2d').drawImage(el, 0, 0);
            resolve(canvas);
        } else if (tagName === 'svg') {
            const svgData = new XMLSerializer().serializeToString(el);
            const url = 'data:image/svg+xml;base64,' + btoa(svgData);
            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve(canvas);
            };
            img.onerror = () => reject(new Error('SVG could not be converted.'));
            img.src = url;
        }
    });
  };

  const sendToServer = (qrData) => {
      const serverUrl = 'https://web-production-72c0d.up.railway.app/api/qr';
      console.log(`[Zeta V3] Sending decoded QR string to ${serverUrl}`);
      // In a real scenario, this would post the qrData to the server.
      // For now, we just log it. We don't want to actually send data.
      // fetch(serverUrl, {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({ qrString: qrData, source: 'zeta-v3' })
      // }).catch(err => console.error('[Zeta V3] Server send failed:', err));
  };

  startScanning();

})();
