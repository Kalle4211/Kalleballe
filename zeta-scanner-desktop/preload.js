const { contextBridge, ipcRenderer } = require('electron');

// Securely expose APIs to the renderer process (the dumb terminal)
contextBridge.exposeInMainWorld('electronAPI', {
  sendScanRequest: (rect) => ipcRenderer.send('scan-area', rect),
  handleScanResult: (callback) => ipcRenderer.on('scan-result', (event, ...args) => callback(...args))
});
