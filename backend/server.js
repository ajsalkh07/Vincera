require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const router = require('./router');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vincera')
    .then(() => {
        console.log('Connected to MongoDB');
    }).catch(err => {
        console.error('MongoDB connection error:', err);
    });

// Create raw HTTP server
const server = http.createServer((req, res) => {
    // Pass request and response to custom router
    router(req, res);
});

// Initialize Socket.io
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join-room', (roomId, user) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', user);

        // Chat
        socket.on('send-chat', (message) => {
            io.to(roomId).emit('receive-chat', { user, message });
        });

        // Polls
        socket.on('create-poll', (pollData) => {
            // pollData: { question, options: [{text, votes:0}] }
            io.to(roomId).emit('new-poll', pollData);
        });

        socket.on('vote-poll', (pollIndex, optionIndex) => {
            // In a real app we'd save to DB. Here we just broadcast the vote event.
            io.to(roomId).emit('update-poll', { pollIndex, optionIndex });
        });

        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', user);
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
