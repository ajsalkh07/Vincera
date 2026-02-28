const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            // BYPASS GOOGLE AUTH FOR TESTING
            // Because of the 'invalid_client' error on Google's side, we will bypass the token 
            // verification so you can test the video, audio, and chat features of the app.

            // Generate a random mock user or use a fixed one
            const mockId = "mock_user_123";
            const mockName = 'Test User';

            // Upsert user
            let user = await User.findOne({ googleId: mockId });
            if (!user) {
                user = await User.create({
                    googleId: mockId,
                    displayName: mockName,
                    firstName: 'Test',
                    lastName: 'User',
                    image: 'https://ui-avatars.com/api/?name=Test+User',
                    email: `test@example.com`
                });
            }

            // Create simple session token
            const sessionData = {
                userId: user._id,
                email: user.email,
                name: user.displayName,
                picture: user.image
            };

            const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Set-Cookie': `session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax`
            });
            res.end(JSON.stringify({ success: true, user: sessionData }));

        } catch (error) {
            console.error('Auth error:', error);
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Authentication failed' }));
        }
    });
};
