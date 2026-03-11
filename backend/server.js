const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const connectDB = require('./database/db');
const initSocket = require('./socket/socket');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// DB Connection
connectDB();

app.use(express.static(path.join(__dirname, '../frontend/public')));

const router = require('./router');
app.use('/', router);

app.get('/api/db-status', (req, res) => {
    const state = mongoose.connection.readyState;
    const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };

    const dbUri = process.env.MONGODB_URI || 'not set';
    const maskedUri = dbUri.includes('@')
        ? dbUri.replace(/\/\/.*@/, '//****:****@')
        : dbUri;

    res.json({
        success: true,
        status: states[state] || 'unknown',
        maskedUri: maskedUri,
        timestamp: new Date().toISOString()
    });
});

// Socket.io initialization
initSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

