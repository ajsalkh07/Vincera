const { RoomServiceClient, AccessToken } = require('livekit-server-sdk');
const cookie = require('cookie');
const Meeting = require('../models/Meeting');

// Ensure Livekit credentials exist
const livekitHost = (process.env.LIVEKIT_URL || 'ws://localhost:7880').trim();
const livekitApiKey = (process.env.LIVEKIT_API_KEY || '').trim();
const livekitApiSecret = (process.env.LIVEKIT_API_SECRET || '').trim();

// warn when keys are missing or still defaults
if (!livekitApiKey || !livekitApiSecret) {
    console.error('⚠️ LiveKit API key/secret not set. Please add LIVEKIT_API_KEY and LIVEKIT_API_SECRET to your .env file.');
}

const roomService = new RoomServiceClient(livekitHost, livekitApiKey, livekitApiSecret);

exports.generateToken = async (req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', async () => {
        try {
            const cookies = cookie.parse(req.headers.cookie || '');
            const sessionCookie = cookies.session;

            if (!sessionCookie) {
                console.error('No session cookie found in request');
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Unauthorized: No session' }));
            }

            let sessionData;
            try {
                sessionData = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('ascii'));
            } catch (e) {
                console.error('Failed to parse session cookie:', e.message);
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid session' }));
            }

            const { roomName, identity: clientIdentity, name: clientName } = JSON.parse(body || '{}');

            if (!roomName) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Missing roomName' }));
            }

            const participantName = clientName || sessionData.name || 'Anonymous';
            const participantIdentity = clientIdentity || (sessionData.userId ? sessionData.userId.toString() : `user_${Math.floor(Math.random() * 10000)}`);

            console.log(`Generating token for ${participantName} (ID: ${participantIdentity}) in room ${roomName}...`);

            // Check if LiveKit keys are present
            if (!livekitApiKey || !livekitApiSecret) {
                throw new Error('LIVEKIT_API_KEY or LIVEKIT_API_SECRET is missing on the server');
            }

            // make sure the room exists
            try {
                const meeting = await Meeting.findOne({ meetingId: roomName });
                if (!meeting) {
                    throw new Error('Meeting not found in database');
                }
                await roomService.createRoom({ name: roomName });
                console.log('Room created/verified in LiveKit');
            } catch (e) {
                if (e.message === 'Meeting not found in database') {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, error: 'Meeting not found' }));
                }
                if (!e.message || !e.message.includes('already exists')) {
                    console.warn('LiveKit Room Service warning:', e.message || e);
                    // Don't throw here, just warn. The token might still work if the host is reachable.
                }
            }

            const at = new AccessToken(livekitApiKey, livekitApiSecret, {
                identity: participantIdentity,
                name: participantName,
                ttl: '1h',
            });

            at.addGrant({
                roomJoin: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
            });

            const token = await at.toJwt();
            console.log('Token generated successfully');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, token, identity: participantIdentity, url: livekitHost }));

        } catch (error) {
            console.error('Token Generation error:', error.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Server error: ' + error.message }));
        }
    });
};
