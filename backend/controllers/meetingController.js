const Meeting = require('../models/Meeting');
const { nanoid } = require('nanoid');

exports.createMeeting = async (req, res) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            // Need to extract user from session cookie, but for now we'll mock or parse if provided
            const cookies = req.headers.cookie;
            if (!cookies || !cookies.includes('session=')) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
            }

            // Very basic cookie parse
            const sessionCookie = cookies.split('; ').find(row => row.startsWith('session=')).split('=')[1];
            const sessionData = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('ascii'));

            const { title } = JSON.parse(body || '{}');
            const meetingId = nanoid(10);

            // Create in DB
            const meeting = await Meeting.create({
                meetingId,
                hostId: sessionData.userId,
                title: title || 'New VINCERA Meeting',
                participants: [sessionData.userId]
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, meetingId, meeting }));

        } catch (error) {
            console.error('Create Meeting error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Server error' }));
        }
    });
};
