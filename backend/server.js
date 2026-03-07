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
const dbUri = process.env.MONGODB_URI || 'not set';
const maskedUri = dbUri.includes('@')
    ? dbUri.replace(/\/\/.*@/, '//****:****@')
    : dbUri;

console.log('Attempting to connect to MongoDB with URI:', maskedUri);

mongoose.connect(dbUri)
    .then(() => console.log('Connected to MongoDB successfully'))
    .catch(err => {
        console.error('MongoDB connection error details:', err.message);
        if (err.message.includes('buffering timed out')) {
            console.error('CRITICAL: Mongoose is buffering but cannot reach the database. Check your MONGODB_URI and Network Access (0.0.0.0/0) in Atlas.');
        }
    });

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
                polls: [],
                isScreenShareAllowed: false, // Only host by default
                isWhiteboardOpen: false,
                isWhiteboardAllowedForAll: false,
                drawingHistory: []
            };
        }

        if (!rooms[roomId].participants.find(p => p.userId === user.userId)) {
            rooms[roomId].participants.push(user);
        }

        // Emit room info only to the joiner
        socket.emit('room-info', {
            hostId: rooms[roomId].hostId,
            participants: rooms[roomId].participants,
            polls: rooms[roomId].polls,
            isScreenShareAllowed: rooms[roomId].isScreenShareAllowed,
            isWhiteboardOpen: rooms[roomId].isWhiteboardOpen,
            isWhiteboardAllowedForAll: rooms[roomId].isWhiteboardAllowedForAll,
            drawingHistory: rooms[roomId].drawingHistory
        });

        socket.to(roomId).emit('user-connected', user);

        socket.on('change-name', (newName) => {
            const p = rooms[roomId].participants.find(part => part.userId === user.userId);
            if (p) {
                p.name = newName;
                io.to(roomId).emit('name-updated', { userId: user.userId, newName });
            }
        });

        socket.on('send-chat', (data) => {
            const isPrivate = data.recipientId && data.recipientId !== 'everyone';
            io.to(roomId).emit('receive-chat', {
                user,
                message: isPrivate ? data.message : (typeof data === 'string' ? data : data.message),
                isPrivate,
                recipientId: isPrivate ? data.recipientId : null
            });
        });

        socket.on('send-reaction', (emoji) => {
            io.to(roomId).emit('new-reaction', { userId: user.userId, emoji });
        });

        socket.on('raise-hand', (isRaised) => {
            const p = rooms[roomId].participants.find(part => part.userId === user.userId);
            if (p) {
                p.isHandRaised = isRaised;
                io.to(roomId).emit('hand-raised-updated', { userId: user.userId, isHandRaised: isRaised });
            }
        });

        socket.on('create-poll', (pollData) => {
            if (rooms[roomId].hostId !== user.userId) return; // Host only
            const poll = { ...pollData, votedIds: [] };
            rooms[roomId].polls.push(poll);
            io.to(roomId).emit('room-info', {
                hostId: rooms[roomId].hostId,
                participants: rooms[roomId].participants,
                polls: rooms[roomId].polls,
                isScreenShareAllowed: rooms[roomId].isScreenShareAllowed,
                isWhiteboardOpen: rooms[roomId].isWhiteboardOpen,
                isWhiteboardAllowedForAll: rooms[roomId].isWhiteboardAllowedForAll
            });
        });

        socket.on('toggle-whiteboard', (isOpen) => {
            if (rooms[roomId].hostId !== user.userId) return;
            rooms[roomId].isWhiteboardOpen = isOpen;
            io.to(roomId).emit('whiteboard-toggled', isOpen);
        });

        socket.on('toggle-whiteboard-permission', (allowed) => {
            if (rooms[roomId].hostId !== user.userId) return;
            rooms[roomId].isWhiteboardAllowedForAll = allowed;
            io.to(roomId).emit('whiteboard-permission-updated', allowed);
        });

        socket.on('draw', (drawData) => {
            const room = rooms[roomId];
            if (!room) return;
            // Check permission
            const isHost = room.hostId === user.userId;
            if (!isHost && !room.isWhiteboardAllowedForAll) return;

            room.drawingHistory.push(drawData);
            socket.to(roomId).emit('user-draw', drawData);
        });

        socket.on('clear-whiteboard', () => {
            if (rooms[roomId].hostId !== user.userId) return;
            rooms[roomId].drawingHistory = [];
            io.to(roomId).emit('whiteboard-cleared');
        });

        socket.on('toggle-screen-share-permission', (allowed) => {
            if (rooms[roomId].hostId !== user.userId) return;
            rooms[roomId].isScreenShareAllowed = allowed;
            io.to(roomId).emit('permission-updated', { type: 'screenShare', allowed });
        });

        socket.on('remote-mute', (targetUserId) => {
            if (rooms[roomId].hostId !== user.userId) return;
            io.to(roomId).emit('remote-mute-request', { targetUserId });
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
                    polls: room.polls,
                    isScreenShareAllowed: room.isScreenShareAllowed
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
                        polls: rooms[roomId].polls,
                        isScreenShareAllowed: rooms[roomId].isScreenShareAllowed,
                        isWhiteboardOpen: rooms[roomId].isWhiteboardOpen,
                        isWhiteboardAllowedForAll: rooms[roomId].isWhiteboardAllowedForAll
                    });
                }
                // Clear drawing history if room is empty
                if (rooms[roomId].participants.length === 0) {
                    delete rooms[roomId];
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
