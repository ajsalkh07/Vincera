const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    googleId: {
        type: String,
        required: true,
        unique: true
    },
    displayName: {
        type: String,
        required: true
    },
    firstName: String,
    lastName: String,
    image: String,
    email: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', UserSchema);
