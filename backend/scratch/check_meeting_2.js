const mongoose = require('mongoose');
const Meeting = require('../models/Meeting');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected');
    const meeting = await Meeting.findOne({ meetingId: 'HEOyMLw6TU' });
    console.log('Meeting HEOyMLw6TU:', meeting);
    process.exit();
}
check();
