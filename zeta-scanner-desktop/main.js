const { app, BrowserWindow, ipcMain, screen, desktopCapturer } = require('electron');
const path = require('path');
const jsQR = require('jsqr');
const Jimp = require('jimp');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 250,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('renderer/index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// The Main Process is the brain. It handles the hard work.
ipcMain.on('scan-area', async (event, rect) => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const screenSize = primaryDisplay.size;

    const sources = await desktopCapturer.getSources({ 
        types: ['screen'], 
        thumbnailSize: { width: screenSize.width, height: screenSize.height } 
    });

    const primarySource = sources[0];
    const fullScreenImageBuffer = primarySource.thumbnail.toPNG();
    
    const image = await Jimp.read(fullScreenImageBuffer);
    image.crop(rect.x, rect.y, rect.width, rect.height);
    
    const code = jsQR(image.bitmap.data, image.bitmap.width, image.bitmap.height);
    
    if (code && code.data) {
      console.log('[Zeta Core] Target Decoded:', code.data);
      // Send ONLY the decoded string back to the UI
      mainWindow.webContents.send('scan-result', {
        success: true,
        decoded: code.data
      });
    } else {
      mainWindow.webContents.send('scan-result', { success: false, error: 'No QR found in area.' });
    }
  } catch (error) {
    console.error('[Zeta Core] Error during scan:', error);
    mainWindow.webContents.send('scan-result', { success: false, error: error.message });
  }
});
