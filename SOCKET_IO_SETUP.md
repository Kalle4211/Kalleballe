# Socket.IO Setup Guide

## Problem
Socket.IO is not connecting because **Netlify only serves static files** - it doesn't run Node.js servers.

## Solution Options

### Option 1: Use Railway for Backend (Recommended)
1. Deploy `server.js` to Railway
2. Get your Railway URL (e.g., `https://your-app.railway.app`)
3. Update `dashboard_control_secret.html` line 396:
   ```javascript
   const SOCKET_SERVER_URL = 'https://your-railway-app.railway.app';
   ```
4. Keep static files on Netlify, but Socket.IO connects to Railway

### Option 2: Use Netlify Functions (Limited)
- Netlify Functions don't support WebSockets well
- Socket.IO won't work properly
- Not recommended for real-time features

### Option 3: Deploy Everything to Railway
- Deploy entire app to Railway
- Use Railway domain instead of Netlify
- Update all URLs to Railway domain

## Current Status
- ✅ Static files: Working on Netlify
- ❌ Socket.IO: Not working (needs Node.js server)
- ✅ API endpoints: Need Railway server

## Quick Fix
Deploy `server.js` to Railway and update the Socket.IO URL in the dashboard.

