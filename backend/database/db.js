const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
    const dbUri = process.env.MONGODB_URI || 'not set';
    const maskedUri = dbUri.includes('@')
        ? dbUri.replace(/\/\/.*@/, '//****:****@')
        : dbUri;

    console.log('Attempting to connect to MongoDB with URI:', maskedUri);

    try {
        await mongoose.connect(dbUri);
        console.log('Connected to MongoDB successfully');
    } catch (err) {
        console.error('MongoDB connection error details:', err.message);
        if (err.message.includes('buffering timed out')) {
            console.error('CRITICAL: Mongoose is buffering but cannot reach the database. Check your MONGODB_URI and Network Access (0.0.0.0/0) in Atlas.');
        }
        process.exit(1);
    }
};

module.exports = connectDB;
