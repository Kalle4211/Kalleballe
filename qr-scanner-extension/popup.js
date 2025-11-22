// Zeta Enhanced QR Scanner - Popup Controller
// Displays real-time scanner statistics and status

document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Zeta QR Scanner Popup Loaded');
  
  // Load statistics from storage
  loadStats();
  
  // Update stats every 2 seconds
  setInterval(loadStats, 2000);
  
  // Check server connection
  checkServerConnection();
});

function loadStats() {
  chrome.storage.local.get([
    'totalScans', 
    'successfulSends', 
    'failedSends', 
    'lastFoundTime',
    'scannerEnabled',
    'serverUrl'
  ], (result) => {
    // Update statistics
    document.getElementById('totalScans').textContent = result.totalScans || 0;
    document.getElementById('successfulSends').textContent = result.successfulSends || 0;
    document.getElementById('failedSends').textContent = result.failedSends || 0;
    
    // Update last found time
    if (result.lastFoundTime) {
      const timeAgo = getTimeAgo(result.lastFoundTime);
      document.getElementById('lastFound').textContent = timeAgo;
    } else {
      document.getElementById('lastFound').textContent = '-';
    }
    
    // Update scanner status
    const status = result.scannerEnabled ? 'Active' : 'Disabled';
    document.getElementById('scannerStatus').textContent = status;
    
    // Update server URL
    document.getElementById('serverUrl').textContent = result.serverUrl || 'Railway';
  });
}

function checkServerConnection() {
  const serverUrl = 'https://web-production-72c0d.up.railway.app';
  
  fetch(serverUrl + '/health', { 
    method: 'GET',
    mode: 'no-cors' // Avoid CORS issues
  })
  .then(() => {
    // If we get here, server is reachable
    updateServerStatus(true);
  })
  .catch(() => {
    // Server unreachable
    updateServerStatus(false);
  });
}

function updateServerStatus(connected) {
  const statusElement = document.getElementById('serverStatus');
  
  if (connected) {
    statusElement.className = 'server-status connected';
    statusElement.textContent = '✅ Connected to Railway';
  } else {
    statusElement.className = 'server-status disconnected';
    statusElement.textContent = '❌ Server Unreachable';
  }
}

function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) { // Less than 1 minute
    return 'Just now';
  } else if (diff < 3600000) { // Less than 1 hour
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  } else if (diff < 86400000) { // Less than 1 day
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'STATS_UPDATE') {
    loadStats();
  }
});

// Open scanner overlay window
document.getElementById('openScanner').addEventListener('click', () => {
  // Get current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      // Inject the scanner overlay into the current page
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['scanner-overlay.js']
      }).then(() => {
        console.log('Scanner overlay injected');
      }).catch(err => {
        console.error('Failed to inject scanner:', err);
      });
    }
  });
}); 