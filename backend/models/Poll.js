const mongoose = require('mongoose');

const PollSchema = new mongoose.Schema({
    meetingId: {
        type: String,
        required: true
    },
    question: {
        type: String,
        required: true
    },
    options: [{
        text: String,
        votes: {
            type: Number,
            default: 0
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('Poll', PollSchema);
