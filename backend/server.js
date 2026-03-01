const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// DB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

app.use(express.static(path.join(__dirname, '../frontend/public')));

const router = require('./router');
app.use('/', router);

// In-memory Room State
const rooms = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId, user) => {
        socket.join(roomId);

        if (!rooms[roomId]) {
            rooms[roomId] = {
                hostId: user.userId,
                participants: [],
                polls: []
            };
        }

        if (!rooms[roomId].participants.find(p => p.userId === user.userId)) {
            rooms[roomId].participants.push(user);
        }

        // Emit room info including host and existing polls
        io.to(roomId).emit('room-info', {
            hostId: rooms[roomId].hostId,
            participants: rooms[roomId].participants,
            polls: rooms[roomId].polls
        });

        socket.to(roomId).emit('user-connected', user);

        socket.on('change-name', (newName) => {
            const p = rooms[roomId].participants.find(part => part.userId === user.userId);
            if (p) {
                p.name = newName;
                io.to(roomId).emit('name-updated', { userId: user.userId, newName });
            }
        });

        socket.on('send-chat', (message) => {
            io.to(roomId).emit('receive-chat', { user, message });
        });

        socket.on('create-poll', (pollData) => {
            const poll = { ...pollData, votedIds: [] };
            rooms[roomId].polls.push(poll);
            io.to(roomId).emit('room-info', rooms[roomId]);
        });

        socket.on('vote-poll', (pIndex, oIndex) => {
            const room = rooms[roomId];
            if (room && room.polls[pIndex] && !room.polls[pIndex].votedIds.includes(user.userId)) {
                room.polls[pIndex].votedIds.push(user.userId);
                room.polls[pIndex].options[oIndex].votes++;
                io.to(roomId).emit('update-poll', { pollIndex: pIndex, optionIndex: oIndex, fullPolls: room.polls });
                // Re-broadcast updated room info to keep everyone in sync
                io.to(roomId).emit('room-info', {
                    hostId: room.hostId,
                    participants: room.participants,
                    polls: room.polls
                });
            }
        });

        socket.on('disconnect', () => {
            if (rooms[roomId]) {
                rooms[roomId].participants = rooms[roomId].participants.filter(p => p.userId !== user.userId);
                if (rooms[roomId].hostId === user.userId && rooms[roomId].participants.length > 0) {
                    rooms[roomId].hostId = rooms[roomId].participants[0].userId;
                    io.to(roomId).emit('room-info', {
                        hostId: rooms[roomId].hostId,
                        participants: rooms[roomId].participants,
                        polls: rooms[roomId].polls
                    });
                }
            }
            socket.to(roomId).emit('user-disconnected', user);
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
