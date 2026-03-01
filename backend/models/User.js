const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    googleId: {
        type: String,
        unique: true,
        sparse: true // Allows multiple null values for non-Google users
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String
    },
    displayName: {
        type: String,
        required: true
    },
    firstName: String,
    lastName: String,
    image: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});


module.exports = mongoose.model('User', UserSchema);
