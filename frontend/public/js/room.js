// Basic room JS setup to be fleshed out with Socket.io and LiveKit later

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

    // Leave logic
    document.getElementById('leaveMeeting').addEventListener('click', () => {
        if (room) {
            room.disconnect();
        }
        window.location.href = '/dashboard';
    });

    const roomName = window.location.pathname.split('/').pop();
    let room;

    // Initialize LiveKit Room
    async function joinRoom() {
        try {
            // Fetch token from our backend
            const response = await fetch('/api/livekit/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName })
            });
            const data = await response.json();

            if (!data.success) {
                alert('Failed to get room token');
                return;
            }

            // Create new LiveKit room
            room = new LivekitClient.Room({
                adaptiveStream: true,
                dynacast: true,
            });

            // Set up event listeners for remote tracks
            room.on(LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
                if (track.kind === LivekitClient.Track.Kind.Video || track.kind === LivekitClient.Track.Kind.Audio) {
                    const element = track.attach();
                    element.id = `track-${participant.sid}-${track.sid}`;

                    if (track.kind === LivekitClient.Track.Kind.Video) {
                        const wrapper = document.createElement('div');
                        wrapper.id = `wrapper-${participant.sid}`;
                        wrapper.className = 'video-wrapper';
                        wrapper.style.position = 'relative';

                        const nameLabel = document.createElement('div');
                        nameLabel.textContent = participant.identity;
                        nameLabel.style.position = 'absolute';
                        nameLabel.style.bottom = '10px';
                        nameLabel.style.left = '10px';
                        nameLabel.style.color = 'white';
                        nameLabel.style.backgroundColor = 'rgba(0,0,0,0.5)';
                        nameLabel.style.padding = '2px 8px';
                        nameLabel.style.borderRadius = '4px';

                        wrapper.appendChild(element);
                        wrapper.appendChild(nameLabel);
                        document.getElementById('video-grid').appendChild(wrapper);
                    } else {
                        // Audio elements don't need UI wrapper usually, just attach to body or hidden div
                        document.body.appendChild(element);
                    }
                }
            });

            room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
                track.detach();
                const wrapper = document.getElementById(`wrapper-${participant.sid}`);
                if (wrapper) wrapper.remove();
            });

            // Connect to LiveKit Server
            await room.connect(data.url, data.token);
            console.log('Connected to room', room.name);

            // Publish local camera and mic
            await room.localParticipant.enableCameraAndMicrophone();

            // Attach local video manually (since the event above is for REMOTES)
            const localVideoTrack = room.localParticipant.getTrackPublication(LivekitClient.Track.Source.Camera);
            if (localVideoTrack && localVideoTrack.videoTrack) {
                const element = localVideoTrack.videoTrack.attach();
                element.id = 'local-video';
                element.muted = true; // Mute local video playback to avoid echo

                const wrapper = document.createElement('div');
                wrapper.className = 'video-wrapper';
                wrapper.style.position = 'relative';

                const nameLabel = document.createElement('div');
                nameLabel.textContent = 'You';
                nameLabel.style.position = 'absolute';
                nameLabel.style.bottom = '10px';
                nameLabel.style.left = '10px';
                nameLabel.style.color = 'white';
                nameLabel.style.backgroundColor = 'rgba(0,0,0,0.5)';
                nameLabel.style.padding = '2px 8px';
                nameLabel.style.borderRadius = '4px';

                wrapper.appendChild(element);
                wrapper.appendChild(nameLabel);
                document.getElementById('video-grid').appendChild(wrapper);
            }

            // Setup basic Controls
            document.getElementById('toggleMic').addEventListener('click', (e) => {
                const isEnabled = room.localParticipant.isMicrophoneEnabled;
                room.localParticipant.setMicrophoneEnabled(!isEnabled);
                e.target.classList.toggle('active', !isEnabled);
            });

            document.getElementById('toggleVideo').addEventListener('click', (e) => {
                const isEnabled = room.localParticipant.isCameraEnabled;
                room.localParticipant.setCameraEnabled(!isEnabled);
                e.target.classList.toggle('active', !isEnabled);
            });

            document.getElementById('toggleScreen').addEventListener('click', async (e) => {
                const isEnabled = room.localParticipant.isScreenShareEnabled;
                await room.localParticipant.setScreenShareEnabled(!isEnabled);
                e.target.classList.toggle('active', !isEnabled);
            });

        } catch (error) {
            console.error('Error joining room:', error);
            // More descriptive error for the user
            let msg = 'Could not join the meeting.';
            if (error.message.includes('token')) msg += ' (Invalid or missing token)';
            else if (error.message.includes('connect')) msg += ' (Connection failed - check your LIVEKIT_URL)';
            else if (error.message.includes('Permission')) msg += ' (Camera/Mic permission denied)';

            alert(msg + '\n\nPlease check your browser console (F12) and ensure your backend .env file has valid LiveKit keys.');
        }
    }

    joinRoom();

    // Socket.io Integration for Chat and Polls
    const socket = io();
    const userSession = JSON.parse(localStorage.getItem('userSession'));

    socket.emit('join-room', roomName, userSession);

    // Chat Logic
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    document.getElementById('sendChat').addEventListener('click', () => {
        const msg = chatInput.value.trim();
        if (msg) {
            socket.emit('send-chat', msg);
            chatInput.value = '';
        }
    });

    socket.on('receive-chat', (data) => {
        const div = document.createElement('div');
        div.innerHTML = `<strong>${data.user.name}:</strong> <span>${data.message}</span>`;
        div.style.marginBottom = '0.5rem';
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // Participants List (Basic socket tracking)
    const participantsList = document.getElementById('participantsList');

    function addParticipantToList(user) {
        const li = document.createElement('li');
        li.id = `user-list-${user.userId}`;
        li.textContent = user.name;
        li.style.marginBottom = '0.5rem';
        li.style.listStyle = 'none';
        participantsList.appendChild(li);
    }

    // Add self to list
    addParticipantToList(userSession);

    socket.on('user-connected', (user) => {
        addParticipantToList(user);
    });

    socket.on('user-disconnected', (user) => {
        const el = document.getElementById(`user-list-${user.userId}`);
        if (el) el.remove();
    });

    // Polls Logic
    let polls = [];
    const activePollsContainer = document.getElementById('activePolls');

    document.getElementById('createPollBtn').addEventListener('click', () => {
        const question = prompt('Enter poll question:');
        if (!question) return;
        const opt1 = prompt('Option 1:');
        const opt2 = prompt('Option 2:');

        if (question && opt1 && opt2) {
            socket.emit('create-poll', {
                question,
                options: [{ text: opt1, votes: 0 }, { text: opt2, votes: 0 }]
            });
        }
    });

    function renderPolls() {
        activePollsContainer.innerHTML = '';
        polls.forEach((poll, pIndex) => {
            const div = document.createElement('div');
            div.style.backgroundColor = '#21262d';
            div.style.padding = '1rem';
            div.style.borderRadius = '6px';
            div.style.marginBottom = '1rem';

            div.innerHTML = `<strong>${poll.question}</strong><br><br>`;

            poll.options.forEach((opt, oIndex) => {
                const btn = document.createElement('button');
                btn.className = 'btn-secondary full-width';
                btn.style.marginBottom = '0.5rem';
                btn.style.textAlign = 'left';
                btn.innerHTML = `${opt.text} <span style="float:right">${opt.votes}</span>`;
                btn.onclick = () => {
                    socket.emit('vote-poll', pIndex, oIndex);
                };
                div.appendChild(btn);
            });
            activePollsContainer.appendChild(div);
        });
    }

    socket.on('new-poll', (pollData) => {
        polls.push(pollData);
        renderPolls();
    });

    socket.on('update-poll', ({ pollIndex, optionIndex }) => {
        if (polls[pollIndex]) {
            polls[pollIndex].options[optionIndex].votes++;
            renderPolls();
        }
    });
});
