const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// Basic router implementation
const router = (req, res) => {
    console.log(`${req.method} ${req.url}`);

    // Parse URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Route logic
    if (req.method === 'GET' && pathname === '/') {
        serveFile(res, path.join(__dirname, '../frontend/public', 'login.html'), 'text/html');
    } else if (req.method === 'GET' && pathname === '/dashboard') {
        serveFile(res, path.join(__dirname, '../frontend/public', 'dashboard.html'), 'text/html');
    } else if (req.method === 'GET' && pathname.startsWith('/room/')) {
        serveFile(res, path.join(__dirname, '../frontend/public', 'room.html'), 'text/html');
    }
    // API Routes example
    else if (req.method === 'POST' && pathname === '/api/auth/google') {
        const authController = require('./controllers/authController');
        authController.googleLogin(req, res);
    }
    else if (req.method === 'POST' && pathname === '/api/meeting/create') {
        const meetingController = require('./controllers/meetingController');
        meetingController.createMeeting(req, res);
    }
    else if (req.method === 'POST' && pathname === '/api/livekit/token') {
        const livekitController = require('./controllers/livekitController');
        livekitController.generateToken(req, res);
    }
    else {
        // Serve static files from 'public' directory
        serveStatic(req, res);
    }
};

const serveStatic = (req, res) => {
    const filePath = path.join(__dirname, '../frontend/public', req.url === '/' ? 'login.html' : req.url);
    const contentType = mime.contentType(path.extname(filePath)) || 'application/octet-stream';
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        serveFile(res, filePath, contentType);
    } else {
        serve404(res);
    }
}

const serveFile = (res, filePath, contentType) => {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            serve500(res, err);
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
};

const serve404 = (res) => {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
};

const serve500 = (res, err) => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`500 Internal Server Error: ${err.code}`);
};

module.exports = router;
