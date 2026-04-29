// In-memory Room State
const rooms = {};

module.exports = (io) => {
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

            user.socketId = socket.id;
            const existingParticipant = rooms[roomId].participants.find(p => p.userId === user.userId);
            if (!existingParticipant) {
                rooms[roomId].participants.push(user);
            } else {
                existingParticipant.socketId = socket.id;
                Object.assign(existingParticipant, user);
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
                const messagePayload = {
                    user,
                    message: typeof data === 'string' ? data : data.message,
                    isPrivate,
                    recipientId: isPrivate ? data.recipientId : null
                };

                if (isPrivate) {
                    const recipient = rooms[roomId].participants.find(p => p.userId === data.recipientId);
                    if (recipient && recipient.socketId) {
                        io.to(recipient.socketId).emit('receive-chat', messagePayload);
                        socket.emit('receive-chat', messagePayload);
                    }
                } else {
                    io.to(roomId).emit('receive-chat', messagePayload);
                }
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

            socket.on('mute-all', () => {
                if (rooms[roomId].hostId !== user.userId) return;
                socket.to(roomId).emit('remote-mute-request', { all: true });
            });

            socket.on('toggle-lock', (isLocked) => {
                if (rooms[roomId].hostId !== user.userId) return;
                rooms[roomId].isLocked = isLocked;
                io.to(roomId).emit('lock-status-updated', { isLocked });
            });

            // Request to join logic moved outside join-room
            socket.on('join-response', ({ targetSocketId, allowed }) => {
                if (rooms[roomId].hostId !== user.userId) return;
                io.to(targetSocketId).emit('join-response', { allowed });
            });

            socket.on('kick-participant', (targetUserId) => {
                if (rooms[roomId].hostId !== user.userId) return; // Host only
                const target = rooms[roomId].participants.find(p => p.userId === targetUserId);
                if (target && target.socketId) {
                    io.to(target.socketId).emit('kicked');
                    io.to(roomId).emit('user-kicked', { userId: targetUserId, name: target.name });
                }
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

        socket.on('request-to-join', (requestData) => {
            const { roomId } = requestData;
            const host = rooms[roomId]?.participants.find(p => p.userId === rooms[roomId].hostId);
            if (host && host.socketId) {
                io.to(host.socketId).emit('join-request', { ...requestData, socketId: socket.id });
            }
        });
    });
};
