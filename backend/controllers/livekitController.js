const { RoomServiceClient, AccessToken } = require('livekit-server-sdk');

// Ensure Livekit credentials exist
const livekitHost = (process.env.LIVEKIT_URL || 'ws://localhost:7880').trim();
const livekitApiKey = (process.env.LIVEKIT_API_KEY || '').trim();
const livekitApiSecret = (process.env.LIVEKIT_API_SECRET || '').trim();

// warn when keys are missing or still defaults
if (!livekitApiKey || !livekitApiSecret) {
    console.error('⚠️ LiveKit API key/secret not set. Please add LIVEKIT_API_KEY and LIVEKIT_API_SECRET to your .env file.');
}
if (livekitApiKey === 'devkey' || livekitApiSecret === 'secret') {
    console.warn('Using default LiveKit credentials. Generated tokens are likely to be rejected by a real LiveKit server.');
}

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

            // make sure the room exists (LiveKit will auto-create by default but explicit call helps catch errors early)
            try {
                await roomService.createRoom({ name: roomName });
            } catch (e) {
                // ignore if the room already exists
                if (!e.message || !e.message.includes('already exists')) {
                    console.warn('Room creation warning:', e.message || e);
                }
            }

            const at = new AccessToken(livekitApiKey, livekitApiSecret, {
                identity: participantIdentity,
                name: participantName,
                // set a reasonable time‑to‑live; tokens default to very short expiration
                ttl: '1h',
            });

            at.addGrant({
                roomJoin: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
            });

            const token = await at.toJwt();

            console.log(`Generated token for room: ${roomName}, URL: ${livekitHost}`);
            // logging token is only for development / debugging
            console.log(`Token (first 30 chars): ${token.slice(0,30)}...`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, token, identity: participantIdentity, url: livekitHost }));

        } catch (error) {
            console.error('Token Generation error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Server error' }));
        }
    });
};
