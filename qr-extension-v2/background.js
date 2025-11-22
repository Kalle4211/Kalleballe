// Listens for the extension icon to be clicked
chrome.action.onClicked.addListener((tab) => {
  console.log('[Zeta V3] Action clicked. Injecting scanner.');
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['scanner.js']
  }).catch(err => console.error('[Zeta V3] Injection failed:', err));
});
