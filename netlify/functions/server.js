// Netlify Function wrapper for Express server
const serverless = require('serverless-http');
const express = require('express');
const http = require('http');
const path = require('path');

// Import the main server setup
// We need to adapt it for serverless
const app = express();
const server = http.createServer(app);

// For Netlify, we'll use serverless-http
// But Socket.IO needs special handling
const handler = serverless(app);

module.exports.handler = async (event, context) => {
    // Enable binary support for Netlify
    context.callbackWaitsForEmptyEventLoop = false;
    
    return await handler(event, context);
};

