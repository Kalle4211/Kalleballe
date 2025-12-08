// Zeta Enhanced QR Scanner - Background Service Worker
// Handles extension lifecycle and provides stability features

console.log('🚀 Zeta Enhanced QR Scanner Background Service Worker Started');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('✅ Zeta QR Scanner installed:', details.reason);
  
  // Set default settings
  chrome.storage.local.set({
    scannerEnabled: true,
    scanInterval: 2000,
    serverUrl: 'https://web-production-72c0d.up.railway.app/',
    lastQRFound: null,
    totalScans: 0,
    successfulSends: 0,
    failedSends: 0
  }).catch(err => {
    console.log('⚠️ Storage error:', err);
  });
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('🔥 Zeta QR Scanner started');
});

// Handle messages from content scripts with error handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    console.log('📨 Background received message:', request);
    
    if (request.type === 'QR_FOUND') {
      // Log QR found event
      chrome.storage.local.get(['totalScans'], (result) => {
        const newTotal = (result.totalScans || 0) + 1;
        chrome.storage.local.set({ 
          totalScans: newTotal,
          lastQRFound: request.qrData,
          lastFoundTime: Date.now()
        }).catch(err => {
          console.log('⚠️ Storage error:', err);
        });
      });
    }
    
    if (request.type === 'QR_SENT_SUCCESS') {
      // Log successful send
      chrome.storage.local.get(['successfulSends'], (result) => {
        const newTotal = (result.successfulSends || 0) + 1;
        chrome.storage.local.set({ successfulSends: newTotal }).catch(err => {
          console.log('⚠️ Storage error:', err);
        });
      });
    }
    
    if (request.type === 'QR_SENT_FAILED') {
      // Log failed send
      chrome.storage.local.get(['failedSends'], (result) => {
        const newTotal = (result.failedSends || 0) + 1;
        chrome.storage.local.set({ failedSends: newTotal }).catch(err => {
          console.log('⚠️ Storage error:', err);
        });
      });
    }
    
    sendResponse({ status: 'received' });
  } catch (error) {
    console.log('❌ Background message handler error:', error);
    sendResponse({ status: 'error', error: error.message });
  }
});

// Handle tab updates to ensure scanner is active
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status === 'complete' && tab.url) {
      console.log('📄 Tab updated:', tab.url);
      
      // Inject content script if needed
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['jsQR.min.js', 'content.js']
      }).catch(err => {
        console.log('⚠️ Script injection failed:', err);
      });
    }
  } catch (error) {
    console.log('❌ Tab update handler error:', error);
  }
});

// Keep service worker alive with error handling
setInterval(() => {
  try {
    console.log('💓 Zeta QR Scanner background heartbeat');
  } catch (error) {
    console.log('❌ Background heartbeat error:', error);
  }
}, 30000); 