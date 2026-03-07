const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const { idToken } = JSON.parse(body);

            if (!idToken) {
                throw new Error('No ID Token provided');
            }

            console.log('Verifying Google ID Token...');
            const ticket = await client.verifyIdToken({
                idToken: idToken,
                audience: process.env.GOOGLE_CLIENT_ID
            });

            const payload = ticket.getPayload();
            const { sub: googleId, email, name, picture, given_name, family_name } = payload;
            console.log('Token verified for:', email);

            // Upsert user in database
            console.log('Querying database for user:', googleId);
            let user = await User.findOne({ googleId });
            if (!user) {
                console.log('Creating new user:', email);
                user = await User.create({
                    googleId,
                    displayName: name,
                    firstName: given_name,
                    lastName: family_name,
                    image: picture,
                    email: email
                });
            } else {
                console.log('Updating existing user:', email);
                // Update user info if it changed
                user.displayName = name;
                user.image = picture;
                user.email = email;
                await user.save();
            }
            console.log('User processed successfully');

            // Create simple session token (Base64 encoded JSON for now, as per existing design)
            // In a production app, use JWT or a secure session store.
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
            console.error('CRITICAL Auth error:', error.message);
            console.error(error.stack);
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Authentication failed: ' + error.message }));
        }
    });
};

exports.register = async (req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
        try {
            const { email, password, name } = JSON.parse(body);
            if (!email || !password || !name) throw new Error('Missing fields');

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'User already exists' }));
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const user = await User.create({
                email,
                password: hashedPassword,
                displayName: name,
                image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`
            });

            const sessionData = { userId: user._id, email: user.email, name: user.displayName, picture: user.image };
            const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');

            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Set-Cookie': `session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax`
            });
            res.end(JSON.stringify({ success: true, user: sessionData }));
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
    });
};

exports.login = async (req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
        try {
            const { email, password } = JSON.parse(body);
            const user = await User.findOne({ email });

            if (!user || !user.password) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Invalid credentials' }));
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: 'Invalid credentials' }));
            }

            const sessionData = { userId: user._id, email: user.email, name: user.displayName, picture: user.image };
            const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');

            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Set-Cookie': `session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax`
            });
            res.end(JSON.stringify({ success: true, user: sessionData }));
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
    });
};
