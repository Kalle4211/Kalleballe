// Listens for the extension icon to be clicked
chrome.action.onClicked.addListener((tab) => {
  console.log('[Zeta V3 Final] Action clicked. Injecting scanner.');
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['scanner.js']
  }).catch(err => console.error('[Zeta V3 Final] Injection failed:', err));
});

// Listen for screenshot requests from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'REQUEST_AREA_SCREENSHOT') {
        chrome.tabs.captureVisibleTab(sender.tab.windowId, {
            format: 'png'
        }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            
            // This background script no longer decodes. It just captures and crops.
            const rect = request.rect;
            const dpr = request.dpr || 1;
            const sourceImage = new Image();
            
            sourceImage.onload = () => {
                const canvas = new OffscreenCanvas(rect.width * dpr, rect.height * dpr);
                const ctx = canvas.getContext('2d');

                ctx.drawImage(
                    sourceImage,
                    rect.x * dpr, rect.y * dpr,
                    rect.width * dpr, rect.height * dpr,
                    0, 0,
                    canvas.width, canvas.height
                );
                
                canvas.convertToBlob().then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        sendResponse({ success: true, screenshot: reader.result });
                    };
                    reader.readAsDataURL(blob);
                });
            };
            
            sourceImage.onerror = () => {
                sendResponse({ success: false, error: 'Failed to load image for cropping.' });
            };
            
            sourceImage.src = dataUrl;
        });

        return true; // Keep the message channel open for async response
    }
});
