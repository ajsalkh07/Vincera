const mongoose = require('mongoose');

const MeetingSchema = new mongoose.Schema({
    meetingId: {
        type: String,
        required: true,
        unique: true
    },
    hostId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        default: 'VINCERA Meeting'
    },
    status: {
        type: String,
        enum: ['active', 'ended'],
        default: 'active'
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Meeting', MeetingSchema);
