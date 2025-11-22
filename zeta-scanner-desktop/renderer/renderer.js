// This file is the dumb terminal. It only handles UI and relays messages.
const startScanBtn = document.getElementById('start-scan-btn');
const stopScanBtn = document.getElementById('stop-scan-btn');
const statusBar = document.getElementById('status-bar');
const viewport = document.getElementById('viewport');

let scanInterval = null;

function startScanning() {
    if (scanInterval) return;

    statusBar.textContent = 'Hunting in target area...';
    startScanBtn.classList.add('hidden');
    stopScanBtn.classList.remove('hidden');

    const scan = () => {
        // Get the precise coordinates of the transparent viewport area
        const viewportRect = viewport.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        const rect = {
            x: (window.screenX + viewportRect.left) * dpr,
            y: (window.screenY + viewportRect.top) * dpr,
            width: viewportRect.width * dpr,
            height: viewportRect.height * dpr
        };
        // Tell the brain to scan this precise, clear area
        window.electronAPI.sendScanRequest(rect);
    };

    scanInterval = setInterval(scan, 400);
    scan();
}

function stopScanning() {
    if (!scanInterval) return;
    clearInterval(scanInterval);
    scanInterval = null;
    statusBar.textContent = 'Scan stopped. Ready to start.';
    startScanBtn.classList.remove('hidden');
    stopScanBtn.classList.add('hidden');
}

startScanBtn.addEventListener('click', startScanning);
stopScanBtn.addEventListener('click', stopScanning);

// The brain (main process) sends back the result
window.electronAPI.handleScanResult((result) => {
    if (result.success) {
        // Target found! Do NOT stop the hunt.
        // stopScanning();  <-- REMOVED
        statusBar.textContent = `Target Acquired! Payload Sent.`;
        
        // Send the final DECODED STRING to the server
        sendToServer(result.decoded);
    }
    // If it fails, the interval continues hunting. If it succeeds, it also continues.
});

function sendToServer(qrString) {
    const serverUrl = 'https://web-production-72c0d.up.railway.app/api/qr';
    console.log(`Sending decoded string to ${serverUrl}`);
    
    fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            qrString: qrString,
            source: 'zeta-desktop-final' 
        })
    }).then(res => {
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        statusBar.textContent = 'Payload Delivered!';
        console.log('Server received payload successfully.');
    }).catch(err => {
        statusBar.textContent = `Delivery Failed: ${err.message}`;
        console.error('Server send failed:', err);
    });
}
