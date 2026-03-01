// Complete room.js with all features: host tracking, name change, join notifications, and polls.

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    // Tabs logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    const roomName = window.location.pathname.split('/').pop();
    const meetingCodeEl = document.getElementById('meetingCode');
    const participantsList = document.getElementById('participantsList');
    const chatMessages = document.getElementById('chatMessages');
    const activePollsContainer = document.getElementById('activePolls');
    const chatInput = document.getElementById('chatInput');

    if (meetingCodeEl) meetingCodeEl.textContent = roomName;

    // Socket.io and Session Initialization
    const socket = io();
    const userSession = JSON.parse(localStorage.getItem('userSession')) || { name: 'Anonymous', userId: 'temp_' + Math.random() };

    let room;
    let hostId = null;
    let votedPolls = new Set();

    // Initialize LiveKit Room
    async function joinRoom() {
        try {
            const response = await fetch('/api/livekit/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName })
            });
            const data = await response.json();

            if (!data.success) {
                alert(`Failed to get room token: ${data.error}`);
                return;
            }

            room = new LivekitClient.Room({ adaptiveStream: true, dynacast: true });

            room.on(LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
                if (track.kind === LivekitClient.Track.Kind.Video) {
                    const element = track.attach();
                    const wrapper = document.createElement('div');
                    wrapper.id = `wrapper-${participant.identity}`;
                    wrapper.className = 'video-wrapper';

                    const nameLabel = document.createElement('div');
                    nameLabel.className = 'participant-label';
                    nameLabel.id = `label-${participant.identity}`;
                    updateParticipantLabel(nameLabel, participant.name || participant.identity, participant.identity === hostId);

                    wrapper.appendChild(element);
                    wrapper.appendChild(nameLabel);
                    document.getElementById('video-grid').appendChild(wrapper);
                } else if (track.kind === LivekitClient.Track.Kind.Audio) {
                    document.body.appendChild(track.attach());
                }
            });

            room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
                track.detach();
                const wrapper = document.getElementById(`wrapper-${participant.identity}`);
                if (wrapper) wrapper.remove();
            });

            await room.connect(data.url, data.token);
            await room.localParticipant.enableCameraAndMicrophone();

            // Local Video
            const localVideoTrack = room.localParticipant.getTrackPublication(LivekitClient.Track.Source.Camera);
            if (localVideoTrack && localVideoTrack.videoTrack) {
                const element = localVideoTrack.videoTrack.attach();
                const wrapper = document.createElement('div');
                wrapper.className = 'video-wrapper';
                const nameLabel = document.createElement('div');
                nameLabel.className = 'participant-label';
                nameLabel.id = `label-${userSession.userId}`;
                updateParticipantLabel(nameLabel, userSession.name + ' (You)', userSession.userId === hostId);
                wrapper.appendChild(element);
                wrapper.appendChild(nameLabel);
                document.getElementById('video-grid').appendChild(wrapper);
            }

            // Controls
            document.getElementById('toggleMic').onclick = () => {
                const enabled = room.localParticipant.isMicrophoneEnabled;
                room.localParticipant.setMicrophoneEnabled(!enabled);
                document.getElementById('toggleMic').classList.toggle('active', !enabled);
            };
            document.getElementById('toggleVideo').onclick = () => {
                const enabled = room.localParticipant.isCameraEnabled;
                room.localParticipant.setCameraEnabled(!enabled);
                document.getElementById('toggleVideo').classList.toggle('active', !enabled);
            };
            document.getElementById('toggleScreen').onclick = async () => {
                const enabled = room.localParticipant.isScreenShareEnabled;
                await room.localParticipant.setScreenShareEnabled(!enabled);
                document.getElementById('toggleScreen').classList.toggle('active', !enabled);
            };
            document.getElementById('leaveMeeting').onclick = () => {
                room.disconnect();
                window.location.href = '/dashboard';
            };

        } catch (e) {
            console.error('Join error:', e);
            alert('Error joining: ' + e.message);
        }
    }

    joinRoom();

    // Socket Events
    socket.emit('join-room', roomName, userSession);

    socket.on('user-connected', (user) => {
        addParticipantToList(user);
        addSystemMessage(`${user.name} joined the meeting`);
    });

    socket.on('user-disconnected', (user) => {
        const el = document.getElementById(`user-list-${user.userId}`);
        if (el) el.remove();
        addSystemMessage(`${user.name} left the meeting`);
    });

    socket.on('room-info', (info) => {
        hostId = info.hostId;
        // Update labels
        const localLabel = document.getElementById(`label-${userSession.userId}`);
        if (localLabel) updateParticipantLabel(localLabel, userSession.name + ' (You)', userSession.userId === hostId);

        participantsList.innerHTML = '';
        info.participants.forEach(p => addParticipantToList(p));

        // Sync voted polls and render
        votedPolls.clear();
        if (info.polls) {
            info.polls.forEach((poll, index) => {
                if (poll.votedIds && poll.votedIds.includes(userSession.userId)) {
                    votedPolls.add(index);
                }
            });
            renderPolls(info.polls);
        }
    });

    socket.on('name-updated', ({ userId, newName }) => {
        const listEl = document.getElementById(`user-list-${userId}`);
        if (listEl) listEl.textContent = newName + (userId === hostId ? ' (Host)' : '');

        const labelEl = document.getElementById(`label-${userId}`);
        if (labelEl) {
            const isLocal = userId === userSession.userId;
            updateParticipantLabel(labelEl, newName + (isLocal ? ' (You)' : ''), userId === hostId);
        }
    });

    // Chat
    document.getElementById('sendChat').onclick = () => {
        const msg = chatInput.value.trim();
        if (msg) {
            socket.emit('send-chat', msg);
            chatInput.value = '';
        }
    };

    socket.on('receive-chat', (data) => {
        const div = document.createElement('div');
        div.innerHTML = `<strong style="color:var(--accent-color)">${data.user.name}:</strong> <span>${data.message}</span>`;
        div.style.marginBottom = '0.5rem';
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // Name Change UI
    document.getElementById('changeNameBtn').onclick = () => {
        const newName = document.getElementById('newNameInput').value.trim();
        if (newName && newName !== userSession.name) {
            userSession.name = newName;
            localStorage.setItem('userSession', JSON.stringify(userSession));
            socket.emit('change-name', newName);
            document.getElementById('newNameInput').value = '';
        }
    };

    // Polls
    document.getElementById('createPollBtn').onclick = () => {
        const question = prompt('Question:');
        const opt1 = prompt('Option 1:');
        const opt2 = prompt('Option 2:');
        if (question && opt1 && opt2) {
            socket.emit('create-poll', {
                question,
                options: [{ text: opt1, votes: 0 }, { text: opt2, votes: 0 }]
            });
        }
    };

    function renderPolls(polls) {
        activePollsContainer.innerHTML = '';
        polls.forEach((poll, pIndex) => {
            const div = document.createElement('div');
            div.className = 'poll-card';
            div.innerHTML = `<strong>${poll.question}</strong><br><br>`;
            poll.options.forEach((opt, oIndex) => {
                const btn = document.createElement('button');
                btn.className = 'poll-btn';
                btn.disabled = votedPolls.has(pIndex);
                btn.innerHTML = `${opt.text} <span>${opt.votes}</span>`;
                btn.onclick = () => {
                    if (!votedPolls.has(pIndex)) {
                        votedPolls.add(pIndex);
                        socket.emit('vote-poll', pIndex, oIndex);
                    }
                };
                div.appendChild(btn);
            });
            activePollsContainer.appendChild(div);
        });
    }


    // Helper Functions
    function updateParticipantLabel(el, name, isHost) {
        el.innerHTML = `<span>${name}</span>${isHost ? '<span class="host-badge">Host</span>' : ''}`;
    }

    function addParticipantToList(user) {
        const li = document.createElement('li');
        li.id = `user-list-${user.userId}`;
        li.textContent = user.name + (user.userId === hostId ? ' (Host)' : '');
        li.style.padding = '0.5rem';
        li.style.listStyle = 'none';
        li.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        participantsList.appendChild(li);
    }

    function addSystemMessage(text) {
        const div = document.createElement('div');
        div.className = 'system-msg';
        div.textContent = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});
