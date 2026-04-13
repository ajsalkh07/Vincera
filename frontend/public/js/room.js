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
    const userSession = JSON.parse(sessionStorage.getItem(getSessionKey())) || { name: 'Anonymous', userId: 'temp_' + Math.random() };

    const zoomOverlay = document.getElementById('zoom-overlay');
    if (zoomOverlay) {
        console.log('Zoom overlay initialized');
        zoomOverlay.addEventListener('click', () => {
            console.log('Overlay clicked, closing zoom');
            document.querySelectorAll('.video-wrapper.zoomed').forEach(el => el.classList.remove('zoomed'));
            zoomOverlay.classList.remove('active');
        });
    }

    function setupZoom(wrapper) {
        if (!wrapper) return;
        console.log('Setting up zoom for wrapper:', wrapper.id);
        wrapper.addEventListener('click', (e) => {
            console.log('Video wrapper clicked:', wrapper.id);
            const isZoomed = wrapper.classList.contains('zoomed');

            document.querySelectorAll('.video-wrapper.zoomed').forEach(el => el.classList.remove('zoomed'));

            if (!isZoomed && zoomOverlay) {
                console.log('Zooming in:', wrapper.id);
                wrapper.classList.add('zoomed');
                zoomOverlay.classList.add('active');
            } else if (zoomOverlay) {
                console.log('Zooming out:', wrapper.id);
                zoomOverlay.classList.remove('active');
            }
        });
    }

    let room;
    let hostId = null;
    let votedPolls = new Set();
    let isScreenShareAllowed = false;
    let isWhiteboardOpen = false;
    let isWhiteboardAllowedForAll = false;

    // Whiteboard Variables
    const wbOverlay = document.getElementById('whiteboard-overlay');
    const wbCanvas = document.getElementById('whiteboard-canvas');
    const wbCtx = wbCanvas.getContext('2d');
    const wbColorInput = document.getElementById('wbColor');
    const wbSizeInput = document.getElementById('wbBrushSize');
    const wbClearBtn = document.getElementById('wbClear');
    const wbCloseBtn = document.getElementById('wbClose');
    const toggleWbBtn = document.getElementById('toggleWhiteboard');

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    let isLobbyMicEnabled = true;
    let isLobbyCamEnabled = true;
    let localStream = null;

    // Initialize Pre-join Lobby
    async function initPreJoin() {
        const lobbyVideo = document.getElementById('lobbyVideoPreview');
        const emptyAvatar = document.querySelector('.lobby-empty-avatar');
        const lobbyMicBtn = document.getElementById('lobbyToggleMic');
        const lobbyCamBtn = document.getElementById('lobbyToggleCam');
        document.getElementById('lobbyMeetingCode').textContent = roomName;

        lobbyMicBtn.innerHTML = ICONS.mic;
        lobbyCamBtn.innerHTML = ICONS.video;

        async function startPreview() {
            try {
                // Initialize name input from session
                const lobbyNameInput = document.getElementById('lobbyNameInput');
                if (lobbyNameInput) {
                    lobbyNameInput.value = userSession.name || '';
                }

                localStream = await navigator.mediaDevices.getUserMedia({ video: isLobbyCamEnabled, audio: isLobbyMicEnabled });
                lobbyVideo.srcObject = localStream;
                emptyAvatar.style.display = 'none';
                lobbyVideo.style.display = 'block';
            } catch (err) {
                console.error("Error accessing media devices.", err);
                emptyAvatar.style.display = 'flex';
                lobbyVideo.style.display = 'none';
                isLobbyCamEnabled = false;
                isLobbyMicEnabled = false;
                lobbyMicBtn.classList.add('active');
                lobbyCamBtn.classList.add('active');
                lobbyMicBtn.innerHTML = ICONS.micOff;
                lobbyCamBtn.innerHTML = ICONS.videoOff;
            }
        }

        lobbyMicBtn.onclick = () => {
            isLobbyMicEnabled = !isLobbyMicEnabled;
            lobbyMicBtn.classList.toggle('active', !isLobbyMicEnabled);
            lobbyMicBtn.innerHTML = !isLobbyMicEnabled ? ICONS.micOff : ICONS.mic;
            if (localStream && localStream.getAudioTracks().length > 0) {
                localStream.getAudioTracks()[0].enabled = isLobbyMicEnabled;
            }
        };

        lobbyCamBtn.onclick = async () => {
            isLobbyCamEnabled = !isLobbyCamEnabled;
            lobbyCamBtn.classList.toggle('active', !isLobbyCamEnabled);
            lobbyCamBtn.innerHTML = !isLobbyCamEnabled ? ICONS.videoOff : ICONS.video;

            if (isLobbyCamEnabled) {
                await startPreview();
            } else {
                if (localStream && localStream.getVideoTracks().length > 0) {
                    localStream.getVideoTracks().forEach(t => t.stop());
                }
                emptyAvatar.style.display = 'flex';
                lobbyVideo.style.display = 'none';
            }
        };

        document.getElementById('btnJoinNow').onclick = () => {
            const newName = document.getElementById('lobbyNameInput').value.trim();
            if (newName) {
                userSession.name = newName;
                sessionStorage.setItem(getSessionKey(), JSON.stringify(userSession));
                // Explicitly emit the name change to the server so everyone sees it
                socket.emit('change-name', newName);
            }

            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            document.getElementById('preJoinLobby').style.display = 'none';
            document.getElementById('mainRoomContainer').style.display = 'flex';
            joinRoom();
        };

        await startPreview();
    }

    // Initialize LiveKit Room
    async function joinRoom() {
        try {
            const response = await fetch('/api/livekit/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomName,
                    identity: userSession.userId,
                    name: userSession.name
                })
            });
            const data = await response.json();

            if (!data.success) {
                alert(`Failed to join room: ${data.error}`);
                window.location.href = '/dashboard';
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
                    setupZoom(wrapper);

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

            room.on(LivekitClient.RoomEvent.ActiveSpeakersChanged, (speakers) => {
                console.log('Active speakers changed:', speakers.map(s => s.identity));
                if (speakers && speakers.length > 0) {
                    const dominantSpeaker = speakers[0];
                    const wrapper = document.getElementById(`wrapper-${dominantSpeaker.identity}`);
                    if (wrapper) {
                        const grid = document.getElementById('video-grid');
                        if (grid.firstChild !== wrapper) {
                            console.log('Moving dominant speaker to front:', dominantSpeaker.identity);
                            grid.prepend(wrapper);
                        }
                    } else {
                        console.warn('Could not find wrapper for speaker:', dominantSpeaker.identity);
                    }
                }
            });

            await room.connect(data.url, data.token);

            // Respect lobby settings
            await room.localParticipant.setMicrophoneEnabled(isLobbyMicEnabled);
            await room.localParticipant.setCameraEnabled(isLobbyCamEnabled);

            // Update bottom control bar UI to match lobby settings
            const mainMicBtn = document.getElementById('toggleMic');
            const mainCamBtn = document.getElementById('toggleVideo');

            mainMicBtn.classList.toggle('active', !isLobbyMicEnabled);
            mainMicBtn.innerHTML = !isLobbyMicEnabled ? ICONS.micOff : ICONS.mic;

            mainCamBtn.classList.toggle('active', !isLobbyCamEnabled);
            mainCamBtn.innerHTML = !isLobbyCamEnabled ? ICONS.videoOff : ICONS.video;

            // Local Video
            if (isLobbyCamEnabled) {
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
                    setupZoom(wrapper);
                }
            }

            // Controls
            document.getElementById('toggleHand').onclick = () => {
                isHandRaised = !isHandRaised;
                socket.emit('raise-hand', isHandRaised);
                document.getElementById('toggleHand').classList.toggle('active', isHandRaised);
            };
            document.getElementById('toggleMic').onclick = async () => {
                const enabled = room.localParticipant.isMicrophoneEnabled;
                try {
                    await room.localParticipant.setMicrophoneEnabled(!enabled);
                    const btn = document.getElementById('toggleMic');
                    btn.classList.toggle('active', enabled);
                    btn.innerHTML = enabled ? ICONS.micOff : ICONS.mic;
                    updateMuteUI(userSession.userId, enabled); // Instantly show for self
                } catch (err) {
                    console.error('Error toggling mic:', err);
                }
            };
            document.getElementById('toggleVideo').onclick = async () => {
                const enabled = room.localParticipant.isCameraEnabled;
                try {
                    await room.localParticipant.setCameraEnabled(!enabled);
                    const btn = document.getElementById('toggleVideo');
                    btn.classList.toggle('active', enabled);
                    btn.innerHTML = enabled ? ICONS.videoOff : ICONS.video;

                    let wrapper = document.getElementById(`wrapper-${userSession.userId}`);

                    if (!enabled) { // Turned camera ON
                        if (!wrapper) {
                            wrapper = document.createElement('div');
                            wrapper.id = `wrapper-${userSession.userId}`;
                            wrapper.className = 'video-wrapper';
                            const nameLabel = document.createElement('div');
                            nameLabel.className = 'participant-label';
                            nameLabel.id = `label-${userSession.userId}`;
                            updateParticipantLabel(nameLabel, userSession.name + ' (You)', userSession.userId === hostId);
                            wrapper.appendChild(nameLabel);
                            document.getElementById('video-grid').appendChild(wrapper);
                            setupZoom(wrapper);

                            // Restore UI state
                            if (!room.localParticipant.isMicrophoneEnabled) {
                                updateMuteUI(userSession.userId, true);
                            }
                            if (isHandRaised) {
                                updateHandUI(userSession.userId, true);
                            }
                        }

                        const pub = room.localParticipant.getTrackPublication(LivekitClient.Track.Source.Camera);
                        if (pub && pub.videoTrack) {
                            const existingVid = wrapper.querySelector('video');
                            if (existingVid) existingVid.remove();
                            const element = pub.videoTrack.attach();
                            wrapper.insertBefore(element, wrapper.firstChild);

                            if (backgroundProcessor) {
                                try { await pub.videoTrack.setProcessor(backgroundProcessor); }
                                catch (e) { console.error("Could not reapply effect", e); }
                            }
                        }
                    } else { // Turned camera OFF
                        if (wrapper) {
                            wrapper.remove();
                        }
                    }
                } catch (err) {
                    console.error('Error toggling video:', err);
                }
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

    initPreJoin();

    let isHandRaised = false;

    // Socket Events
    socket.emit('join-room', roomName, userSession);

    socket.on('hand-raised-updated', ({ userId, isHandRaised }) => {
        updateHandUI(userId, isHandRaised);
    });

    socket.on('user-connected', (user) => {
        addParticipantToList(user);
        addSystemMessage(`${user.name} joined the meeting`);

        // Add to chat recipient dropdown
        const recSel = document.getElementById('chatRecipient');
        if (recSel && user.userId !== userSession.userId) {
            let exists = Array.from(recSel.options).some(o => o.value === user.userId);
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = user.userId;
                opt.textContent = user.name;
                recSel.appendChild(opt);
            }
        }
    });

    socket.on('user-disconnected', (user) => {
        const el = document.getElementById(`user-list-${user.userId}`);
        if (el) el.remove();
        addSystemMessage(`${user.name} left the meeting`);

        // Remove from chat recipient dropdown
        const recSel = document.getElementById('chatRecipient');
        if (recSel) {
            const opt = Array.from(recSel.options).find(o => o.value === user.userId);
            if (opt) {
                if (recSel.value === user.userId) recSel.value = 'everyone';
                opt.remove();
            }
        }
    });

    socket.on('room-info', (info) => {
        hostId = info.hostId;
        isScreenShareAllowed = info.isScreenShareAllowed || false;
        isWhiteboardOpen = info.isWhiteboardOpen || false;
        isWhiteboardAllowedForAll = info.isWhiteboardAllowedForAll || false;

        // Sync Whiteboard Visibility
        wbOverlay.classList.toggle('active', isWhiteboardOpen);
        toggleWbBtn.classList.toggle('active', isWhiteboardOpen);

        // Render previous drawing history
        if (info.drawingHistory && info.drawingHistory.length > 0) {
            // Need to ensure canvas is sized before drawing
            resizeCanvas();
            info.drawingHistory.forEach(data => drawOneLine(data, false));
        }

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

            // Whiteboard Permission Toggle
            const wbToggleDiv = document.createElement('div');
            wbToggleDiv.style.padding = '0.5rem';
            wbToggleDiv.style.borderBottom = '1px solid var(--border-color)';
            wbToggleDiv.style.display = 'flex';
            wbToggleDiv.style.justifyContent = 'space-between';
            wbToggleDiv.style.alignItems = 'center';
            wbToggleDiv.innerHTML = `
                <span style="font-size: 0.8rem;">Allow Whiteboard for All</span>
                <input type="checkbox" id="wbPermToggle" ${isWhiteboardAllowedForAll ? 'checked' : ''}>
            `;
            participantsList.appendChild(wbToggleDiv);

            wbToggleDiv.querySelector('#wbPermToggle').onchange = (e) => {
                socket.emit('toggle-whiteboard-permission', e.target.checked);
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

        // Update chat recipient dropdown
        const recSel = document.getElementById('chatRecipient');
        if (recSel) {
            const opt = Array.from(recSel.options).find(o => o.value === userId);
            if (opt) {
                opt.textContent = newName;
            }
        }
    });

    socket.on('whiteboard-toggled', (isOpen) => {
        isWhiteboardOpen = isOpen;
        wbOverlay.classList.toggle('active', isOpen);
        toggleWbBtn.classList.toggle('active', isOpen);
        if (isOpen) resizeCanvas();
    });

    socket.on('whiteboard-permission-updated', (allowed) => {
        isWhiteboardAllowedForAll = allowed;
        if (!allowed && userSession.userId !== hostId && isWhiteboardOpen) {
            addSystemMessage('The host has disabled drawing permissions.');
        } else if (allowed && userSession.userId !== hostId && isWhiteboardOpen) {
            addSystemMessage('The host has enabled drawing permissions for everyone.');
        }
    });

    socket.on('user-draw', (data) => {
        drawOneLine(data, false);
    });

    socket.on('whiteboard-cleared', () => {
        wbCtx.clearRect(0, 0, wbCanvas.width, wbCanvas.height);
    });

    // Whiteboard Functions
    function resizeCanvas() {
        // Only resize if visible to avoid stretching
        if (wbOverlay.classList.contains('active')) {
            const rect = wbCanvas.getBoundingClientRect();
            // Save current content
            const temp = wbCtx.getImageData(0, 0, wbCanvas.width, wbCanvas.height);
            wbCanvas.width = rect.width;
            wbCanvas.height = rect.height;
            // Restore content
            wbCtx.putImageData(temp, 0, 0);
        }
    }

    function drawOneLine(data, emit = true) {
        wbCtx.beginPath();
        wbCtx.moveTo(data.x0 * wbCanvas.width, data.y0 * wbCanvas.height);
        wbCtx.lineTo(data.x1 * wbCanvas.width, data.y1 * wbCanvas.height);
        wbCtx.strokeStyle = data.color;
        wbCtx.lineWidth = data.size;
        wbCtx.lineCap = 'round';
        wbCtx.stroke();
        wbCtx.closePath();

        if (emit) {
            socket.emit('draw', data);
        }
    }

    function startDrawing(e) {
        const isHost = userSession.userId === hostId;
        if (!isHost && !isWhiteboardAllowedForAll) return;

        isDrawing = true;
        const rect = wbCanvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        lastX = x / wbCanvas.width;
        lastY = y / wbCanvas.height;
    }

    function draw(e) {
        if (!isDrawing) return;
        const rect = wbCanvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        const currentX = x / wbCanvas.width;
        const currentY = y / wbCanvas.height;

        drawOneLine({
            x0: lastX,
            y0: lastY,
            x1: currentX,
            y1: currentY,
            color: wbColorInput.value,
            size: wbSizeInput.value
        });

        lastX = currentX;
        lastY = currentY;
    }

    function stopDrawing() {
        isDrawing = false;
    }

    // Whiteboard Event Listeners
    toggleWbBtn.onclick = () => {
        if (userSession.userId !== hostId) {
            // If not host, toggling only closes it locally if it's already open
            // but the prompt says only Host can start/stop. 
            // I'll make it so host toggles for ALL, and others can only view if open.
            alert('Only the host can start or stop the whiteboard session.');
            return;
        }
        const newState = !isWhiteboardOpen;
        socket.emit('toggle-whiteboard', newState);
    };

    wbCloseBtn.onclick = () => {
        if (userSession.userId === hostId) {
            socket.emit('toggle-whiteboard', false);
        } else {
            wbOverlay.classList.remove('active');
        }
    };

    wbClearBtn.onclick = () => {
        if (userSession.userId !== hostId) {
            alert('Only the host can clear the whiteboard.');
            return;
        }
        socket.emit('clear-whiteboard');
    };

    wbCanvas.addEventListener('mousedown', startDrawing);
    wbCanvas.addEventListener('mousemove', draw);
    wbCanvas.addEventListener('mouseup', stopDrawing);
    wbCanvas.addEventListener('mouseout', stopDrawing);

    // Touch support
    wbCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e); }, { passive: false });
    wbCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, { passive: false });
    wbCanvas.addEventListener('touchend', stopDrawing);

    window.addEventListener('resize', resizeCanvas);

    // Chat
    document.getElementById('sendChat').onclick = () => {
        const msg = chatInput.value.trim();
        const recipientSel = document.getElementById('chatRecipient');
        const recipientId = recipientSel ? recipientSel.value : 'everyone';
        if (msg) {
            socket.emit('send-chat', { message: msg, recipientId });
            chatInput.value = '';
        }
    };

    socket.on('receive-chat', (data) => {
        const div = document.createElement('div');
        let prefix = `<strong style="color:var(--accent-color)">${data.user.name}</strong>`;
        if (data.isPrivate) {
            prefix += ` <em style="color: #8b949e; font-size: 0.8em;">(Direct)</em>`;
        }
        div.innerHTML = `${prefix}: <span>${data.message}</span>`;
        div.style.marginBottom = '0.5rem';
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });


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
