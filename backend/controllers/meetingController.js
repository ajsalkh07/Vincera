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

            const { title, hostId: clientHostId } = JSON.parse(body || '{}');
            const meetingId = nanoid(10);

            const finalHostId = clientHostId || sessionData.userId;

            // Create in DB
            const meeting = await Meeting.create({
                meetingId,
                hostId: finalHostId,
                title: title || 'New VINCERA Meeting',
                participants: [finalHostId]
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

exports.validateMeeting = async (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
        try {
            const { meetingId } = JSON.parse(body || '{}');
            console.log('Validating meeting:', meetingId);
            if (!meetingId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Meeting ID required' }));
            }
            const meeting = await Meeting.findOne({ meetingId });
            console.log('Meeting found:', meeting ? 'Yes' : 'No');
            if (!meeting) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Meeting not found' }));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                isLocked: meeting.isLocked || false,
                hostId: meeting.hostId,
                title: meeting.title
            }));
        } catch (error) {
            console.error('Validate Meeting error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Server error' }));
        }
    });
};

exports.toggleLock = async (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
        try {
            const { meetingId, isLocked } = JSON.parse(body || '{}');
            const cookies = req.headers.cookie;
            if (!cookies || !cookies.includes('session=')) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
            }

            const sessionCookie = cookies.split('; ').find(row => row.startsWith('session=')).split('=')[1];
            const sessionData = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('ascii'));

            const meeting = await Meeting.findOne({ meetingId });
            if (!meeting) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Meeting not found' }));
            }

            if (meeting.hostId.toString() !== sessionData.userId) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Only host can lock/unlock meeting' }));
            }

            meeting.isLocked = isLocked;
            await meeting.save();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, isLocked: meeting.isLocked }));
        } catch (error) {
            console.error('Toggle Lock error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Server error' }));
        }
    });
};
