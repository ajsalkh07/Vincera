const { RoomServiceClient, AccessToken } = require('livekit-server-sdk');

// Ensure Livekit credentials exist
const livekitHost = (process.env.LIVEKIT_URL || 'ws://localhost:7880').trim();
const livekitApiKey = (process.env.LIVEKIT_API_KEY || 'devkey').trim();
const livekitApiSecret = (process.env.LIVEKIT_API_SECRET || 'secret').trim();

const roomService = new RoomServiceClient(livekitHost, livekitApiKey, livekitApiSecret);

exports.generateToken = async (req, res) => {
    // We expect the room name and participant details to be POSTed
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', async () => {
        try {
            const cookies = req.headers.cookie;
            if (!cookies || !cookies.includes('session=')) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
            }

            const sessionCookie = cookies.split('; ').find(row => row.startsWith('session=')).split('=')[1];
            const sessionData = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('ascii'));

            const { roomName } = JSON.parse(body || '{}');

            if (!roomName) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Missing roomName' }));
            }

            const participantName = sessionData.name || 'Anonymous';
            const participantIdentity = sessionData.userId.toString() || `user_${Math.floor(Math.random() * 10000)}`;

            const at = new AccessToken(livekitApiKey, livekitApiSecret, {
                identity: participantIdentity,
                name: participantName,
            });

            at.addGrant({
                roomJoin: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
            });

            const token = await at.toJwt();

            console.log(`Generated token for room: ${roomName}, URL: ${livekitHost}`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, token, identity: participantIdentity, url: livekitHost }));

        } catch (error) {
            console.error('Token Generation error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Server error' }));
        }
    });
};
