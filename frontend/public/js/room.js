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
    const createPollBtn = document.getElementById('createPollBtn');
    const chatInput = document.getElementById('chatInput');

    // SVG Constants
    const ICONS = {
        mic: `<svg viewBox="0 0 24 24" class="lucide lucide-mic"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
        micOff: `<svg viewBox="0 0 24 24" class="lucide lucide-mic-off"><line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 1 5 11v-1"/><path d="M9 10.12V5a3 3 0 0 1 5.91-.74"/><polyline points="15 9.34 15 11 15 11"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
        video: `<svg viewBox="0 0 24 24" class="lucide lucide-video"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>`,
        videoOff: `<svg viewBox="0 0 24 24" class="lucide lucide-video-off"><path d="M10.66 6H14a2 2 0 0 1 2 2v2.34"/><path d="m22 8-6 4 6 4V8Z"/><path d="M2 2l20 20"/><path d="M2 8.22V16a2 2 0 0 0 2 2h12"/></svg>`,
        hand: `<svg viewBox="0 0 24 24" class="lucide lucide-hand"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M18 8a2 2 0 0 1 2 2v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-1.3-6.6-4.4L2 13.6a2 2 0 0 1 0-2.8v0a2 2 0 0 1 2.8 0l2.2 2.2"/></svg>`,
        copy: `<svg viewBox="0 0 24 24" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
        check: `<svg viewBox="0 0 24 24" class="lucide lucide-check"><polyline points="20 6 9 17 4 12"/></svg>`,
        host: `<svg viewBox="0 0 24 24" class="lucide lucide-shield" style="width: 14px; height: 14px; margin-right: 4px; display: inline; vertical-align: text-bottom;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
    };

    if (meetingCodeEl) meetingCodeEl.textContent = roomName;

    // Copy Meeting Code
    const copyBtn = document.getElementById('copyMeetingCode');
    if (copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(roomName).then(() => {
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = ICONS.check;
                setTimeout(() => copyBtn.innerHTML = originalHTML, 2000);
            }).catch(err => {
                console.error('Failed to copy code:', err);
            });
        };
    }

    // Socket.io and Session Initialization
    const socket = io();
    const userSession = JSON.parse(localStorage.getItem('userSession')) || { name: 'Anonymous', userId: 'temp_' + Math.random() };

    let room;
    let hostId = null;
    let votedPolls = new Set();
    let isScreenShareAllowed = false;

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

                    // Check if already muted
                    const audioPub = participant.getTrackPublication(LivekitClient.Track.Source.Microphone);
                    if (audioPub && audioPub.isMuted) {
                        updateMuteUI(participant.identity, true);
                    }
                } else if (track.kind === LivekitClient.Track.Kind.Audio) {
                    document.body.appendChild(track.attach());
                }
            });

            room.on(LivekitClient.RoomEvent.TrackMuted, (publication, participant) => {
                if (publication.kind === LivekitClient.Track.Kind.Audio) {
                    updateMuteUI(participant.identity, true);
                }
            });

            room.on(LivekitClient.RoomEvent.TrackUnmuted, (publication, participant) => {
                if (publication.kind === LivekitClient.Track.Kind.Audio) {
                    updateMuteUI(participant.identity, false);
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
                wrapper.id = `wrapper-${userSession.userId}`;
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
            document.getElementById('toggleHand').onclick = () => {
                isHandRaised = !isHandRaised;
                socket.emit('raise-hand', isHandRaised);
                document.getElementById('toggleHand').classList.toggle('active', isHandRaised);
            };
            document.getElementById('toggleMic').onclick = () => {
                const enabled = room.localParticipant.isMicrophoneEnabled;
                room.localParticipant.setMicrophoneEnabled(!enabled);
                const btn = document.getElementById('toggleMic');
                btn.classList.toggle('active', !enabled);
                btn.innerHTML = !enabled ? ICONS.micOff : ICONS.mic;
                updateMuteUI(userSession.userId, enabled); // Instantly show for self
            };
            document.getElementById('toggleVideo').onclick = () => {
                const enabled = room.localParticipant.isCameraEnabled;
                room.localParticipant.setCameraEnabled(!enabled);
                const btn = document.getElementById('toggleVideo');
                btn.classList.toggle('active', !enabled);
                btn.innerHTML = !enabled ? ICONS.videoOff : ICONS.video;
            };
            document.getElementById('toggleScreen').onclick = async () => {
                const isHost = userSession.userId === hostId;
                if (!isHost && !isScreenShareAllowed) {
                    alert('Screen sharing is restricted to the host.');
                    return;
                }
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

    let isHandRaised = false;

    // Socket Events
    socket.emit('join-room', roomName, userSession);

    socket.on('hand-raised-updated', ({ userId, isHandRaised }) => {
        updateHandUI(userId, isHandRaised);
    });

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
        isScreenShareAllowed = info.isScreenShareAllowed || false;

        // Show/Hide poll creation button
        if (createPollBtn) {
            createPollBtn.style.display = userSession.userId === hostId ? 'block' : 'none';
        }

        // Update labels
        const localLabel = document.getElementById(`label-${userSession.userId}`);
        if (localLabel) updateParticipantLabel(localLabel, userSession.name + ' (You)', userSession.userId === hostId);

        participantsList.innerHTML = '';

        // Host Control: Allow Screen Share Toggle
        if (userSession.userId === hostId) {
            const toggleDiv = document.createElement('div');
            toggleDiv.style.padding = '0.5rem';
            toggleDiv.style.borderBottom = '1px solid var(--border-color)';
            toggleDiv.style.display = 'flex';
            toggleDiv.style.justifyContent = 'space-between';
            toggleDiv.style.alignItems = 'center';
            toggleDiv.innerHTML = `
                <span style="font-size: 0.8rem;">Allow Screen Share for All</span>
                <input type="checkbox" id="screenSharePermToggle" ${isScreenShareAllowed ? 'checked' : ''}>
            `;
            participantsList.appendChild(toggleDiv);

            toggleDiv.querySelector('#screenSharePermToggle').onchange = (e) => {
                socket.emit('toggle-screen-share-permission', e.target.checked);
            };
        }

        info.participants.forEach(p => {
            addParticipantToList(p);
            // Sync hand raised status visually
            if (p.isHandRaised) {
                setTimeout(() => updateHandUI(p.userId, true), 1000);
            }
        });

        // Sync Recipient Selector
        const recSel = document.getElementById('chatRecipient');
        if (recSel) {
            const current = recSel.value;
            recSel.innerHTML = '<option value="everyone">Everyone</option>';
            info.participants.forEach(p => {
                if (p.userId !== userSession.userId) {
                    const opt = document.createElement('option');
                    opt.value = p.userId;
                    opt.textContent = p.name;
                    recSel.appendChild(opt);
                }
            });
            if (Array.from(recSel.options).some(o => o.value === current)) recSel.value = current;
        }

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

    socket.on('update-poll', (data) => {
        // Update local votedPolls if needed or just re-render
        if (data.fullPolls) renderPolls(data.fullPolls);
    });

    socket.on('permission-updated', ({ type, allowed }) => {
        if (type === 'screenShare') {
            isScreenShareAllowed = allowed;
            addSystemMessage(`Screen sharing is now ${allowed ? 'enabled' : 'disabled'} for all participants.`);
        }
    });

    socket.on('remote-mute-request', ({ targetUserId }) => {
        if (targetUserId === userSession.userId) {
            room.localParticipant.setMicrophoneEnabled(false);
            document.getElementById('toggleMic').classList.add('active'); // active means "disabled" in this CSS convention for mic/video
            updateMuteUI(userSession.userId, true);
            alert('The host has muted your microphone.');
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
    if (createPollBtn) {
        console.log('Poll creation button found.');
        createPollBtn.onclick = () => {
            const question = prompt('Question:');
            const opt1 = prompt('Option 1:');
            const opt2 = prompt('Option 2:');
            if (question && opt1 && opt2) {
                console.log('Emitting create-poll event...');
                socket.emit('create-poll', {
                    question,
                    options: [{ text: opt1, votes: 0 }, { text: opt2, votes: 0 }]
                });
            }
        };
    } else {
        console.warn('Poll creation button NOT found in DOM.');
    }

    function renderPolls(polls) {
        if (!activePollsContainer) {
            console.error('activePollsContainer not found, cannot render polls.');
            return;
        }
        console.log(`Rendering ${polls.length} polls...`);
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
                        console.log(`Voting for poll ${pIndex}, option ${oIndex}`);
                        votedPolls.add(pIndex);
                        socket.emit('vote-poll', pIndex, oIndex);
                    }
                };
                div.appendChild(btn);
            });
            activePollsContainer.appendChild(div);
        });
    }


    // Virtual Backgrounds
    let backgroundProcessor = null;
    const effectCards = document.querySelectorAll('.effect-card');

    effectCards.forEach(card => {
        card.addEventListener('click', async () => {
            const effect = card.dataset.effect;
            const url = card.dataset.url;

            effectCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            if (!room || !room.localParticipant) return;
            const videoTrack = room.localParticipant.getTrackPublication(LivekitClient.Track.Source.Camera)?.videoTrack;
            if (!videoTrack) return;

            try {
                // Remove existing processor
                if (videoTrack.processor) {
                    await videoTrack.stopProcessor();
                }

                if (effect === 'none') {
                    backgroundProcessor = null;
                    return;
                }

                if (!backgroundProcessor) {
                    console.log('Initializing BackgroundProcessor v0.7.0...');
                    const TrackProcessors = window.LivekitTrackProcessors || window.LiveKitTrackProcessors;

                    if (!TrackProcessors) {
                        console.error('LiveKitTrackProcessors library not found in window object!');
                        throw new Error('Background processor library not loaded.');
                    }

                    // Try using the default assets path first, or specify one if it fails
                    backgroundProcessor = TrackProcessors.createBackgroundProcessor({
                        blurRadius: 20,
                        assetsPath: 'https://cdn.jsdelivr.net/npm/@livekit/track-processors@0.7.0/dist'
                    });
                    console.log('BackgroundProcessor instance created:', backgroundProcessor);
                }

                if (effect === 'blur') {
                    await backgroundProcessor.setOptions({ type: 'blur', blurRadius: 20 });
                } else if (effect === 'image' && url) {
                    await backgroundProcessor.setOptions({ type: 'image', source: url });
                }

                console.log(`Applying background effect: ${effect}`);
                await videoTrack.setProcessor(backgroundProcessor);
            } catch (err) {
                console.error('Failed to apply background effect:', err);
                alert('Background effect failed to load. Please try again.');
            }
        });
    });

    // Helper Functions
    function updateMuteUI(userId, isMuted) {
        const wrapper = document.getElementById(`wrapper-${userId}`);
        if (wrapper) {
            let muteIndicator = wrapper.querySelector('.muted-indicator');
            if (isMuted) {
                if (!muteIndicator) {
                    muteIndicator = document.createElement('div');
                    muteIndicator.className = 'muted-indicator';
                    muteIndicator.innerHTML = ICONS.micOff;
                    wrapper.appendChild(muteIndicator);
                }
            } else if (muteIndicator) {
                muteIndicator.remove();
            }
        }
    }

    function updateHandUI(userId, isHandRaised) {
        const wrapper = document.getElementById(`wrapper-${userId}`);
        if (wrapper) {
            let handIndicator = wrapper.querySelector('.hand-raised-indicator');
            if (isHandRaised) {
                if (!handIndicator) {
                    handIndicator = document.createElement('div');
                    handIndicator.className = 'hand-raised-indicator';
                    handIndicator.innerHTML = ICONS.hand;
                    wrapper.appendChild(handIndicator);
                }
            } else if (handIndicator) {
                handIndicator.remove();
            }
        }
    }

    function updateParticipantLabel(el, name, isHost) {
        el.innerHTML = `<span>${name}</span>${isHost ? '<span class="host-badge">Host</span>' : ''}`;
    }

    function addParticipantToList(user) {
        if (document.getElementById(`user-list-${user.userId}`)) return;
        const li = document.createElement('li');
        li.id = `user-list-${user.userId}`;
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '0.5rem';
        li.style.listStyle = 'none';
        li.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = user.name + (user.userId === hostId ? ' (Host)' : '');
        li.appendChild(nameSpan);

        // Host Control: Remote Mute
        if (userSession.userId === hostId && user.userId !== hostId) {
            const muteBtn = document.createElement('button');
            muteBtn.className = 'btn-secondary';
            muteBtn.style.padding = '2px 8px';
            muteBtn.style.fontSize = '0.7rem';
            muteBtn.textContent = 'Mute';
            muteBtn.onclick = () => {
                socket.emit('remote-mute', user.userId);
            };
            li.appendChild(muteBtn);
        }

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
