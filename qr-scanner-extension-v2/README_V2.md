# 🔥 Zeta QR Scanner V2

## Overview
This is an enhanced version of the Zeta QR Scanner extension that connects to a different Railway server instance.

## Key Differences from V1
- **Server URL**: `https://web-production-c116.up.railway.app/`
- **Enhanced UI**: Updated popup with better styling
- **Improved Logging**: More detailed console output
- **Better Error Handling**: Enhanced retry logic and connection management

## Features
- 🔍 **Multi-Element Scanning**: Scans canvas, images, SVG, video, and iframes
- 🔄 **Adaptive Retry Logic**: Automatically adjusts scanning frequency based on server response
- 📊 **Real-time Statistics**: Tracks scans, successful sends, and failures
- 🛡️ **Error Recovery**: Handles network issues and extension context invalidation
- 📱 **Modern UI**: Beautiful popup dashboard with live stats

## Installation
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" and select the `qr-scanner-extension-v2` folder
4. The extension will appear in your toolbar

## Testing
1. Load the extension as described above
2. Open `test_v2.html` in your browser
3. Check the browser console for scanning logs
4. Monitor the Railway V2 dashboard for incoming QR codes

## Server Endpoints
- **QR Upload**: `POST /api/qr`
- **Health Check**: `GET /health`
- **Dashboard**: `GET /` (redirects to admin dashboard)

## Console Logs
The extension provides detailed logging with the prefix `[Zeta QR]`:
- 🚀 Initialization messages
- 🔍 Scanning activity
- 📤 Server communication
- ✅ Success confirmations
- ❌ Error reports

## Troubleshooting
- **Extension not loading**: Check if Developer mode is enabled
- **CORS errors**: The extension uses `mode: 'cors'` and `credentials: 'omit'`
- **Context invalidation**: The extension handles this automatically with retry logic
- **Network issues**: Adaptive scanning intervals help manage connection problems

## Version Info
- **Version**: 2.0.0
- **Target Server**: Railway V2
- **Manifest Version**: 3
- **Permissions**: Active tab, storage, scripting

## Support
For issues or questions, check the browser console for detailed error messages and logs. 