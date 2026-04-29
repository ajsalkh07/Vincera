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
            
            // Show sidebar if it's hidden (in case we add a toggle)
            document.querySelector('.sidebar').classList.add('active');
        });
    });

    // Sidebar Close Logic
    const closeSidebarBtn = document.querySelector('.close-sidebar-btn');
    if (closeSidebarBtn) {
        closeSidebarBtn.onclick = () => {
            document.querySelector('.sidebar').classList.remove('active');
            tabBtns.forEach(b => b.classList.remove('active'));
        };
    }

    // Add People Button Logic
    const addPeopleBtn = document.getElementById('addPeopleBtn');
    if (addPeopleBtn) {
        addPeopleBtn.onclick = () => {
            const copyBtn = document.getElementById('copyMeetingCode');
            if (copyBtn) copyBtn.click(); // Trigger the existing copy logic
        };
    }

    // Host Settings Dropdown Logic - Replaced by Host Controls Tab
    const allowScreenShareToggle = document.getElementById('allowScreenShareAll');
    const allowWhiteboardToggle = document.getElementById('allowWhiteboardAll');
    const hostDropdownLockBtn = document.getElementById('hostDropdownLockBtn');

    if (allowScreenShareToggle) {
        allowScreenShareToggle.onchange = (e) => {
            socket.emit('toggle-screen-share-permission', e.target.checked);
        };
    }

    if (allowWhiteboardToggle) {
        allowWhiteboardToggle.onchange = (e) => {
            socket.emit('toggle-whiteboard-permission', e.target.checked);
        };
    }

    if (hostDropdownLockBtn) {
        hostDropdownLockBtn.onclick = () => {
            const toggleBtn = document.getElementById('toggleLockMeeting');
            if (toggleBtn) toggleBtn.click();
        };
    }

    const roomName = decodeURIComponent(window.location.pathname.split('/').pop());

    const meetingCodeEl = document.getElementById('meetingCode');
    const participantsList = document.getElementById('participantsList');
    const hostControlsTabBtn = document.getElementById('hostControlsTabBtn');
    const chatMessages = document.getElementById('chatMessages');
    const activePollsContainer = document.getElementById('activePolls');
    const createPollBtn = document.getElementById('createPollBtn');
    const chatInput = document.getElementById('chatInput');
    const toggleLockBtn = document.getElementById('toggleLockMeeting');
    const lockIcon = document.getElementById('lockIcon');
    const joinRequestsContainer = document.getElementById('joinRequestsContainer');
    const requestToJoinModal = document.getElementById('requestToJoinModal');
    const btnRequestJoin = document.getElementById('btnRequestJoin');
    const requestStatus = document.getElementById('requestStatus');
    const muteAllBtn = document.getElementById('muteAllBtn');
    if (muteAllBtn) {
        muteAllBtn.onclick = () => {
            if (confirm('Mute all participants?')) {
                socket.emit('remote-mute-all');
            }
        };
    }
    const hostControls = document.getElementById('hostControls');

    function formatMeetingCode(code) {
        if (!code || code.length !== 9) return code;
        return `${code.substr(0, 3)}-${code.substr(3, 3)}-${code.substr(6, 3)}`;
    }

    // Bottom Bar Sidebar Toggles
    const toggleParticipantsBtn = document.getElementById('toggleParticipants');
    const toggleChatBtn = document.getElementById('toggleChat');
    const sidebar = document.querySelector('.sidebar');

    function openSidebarTab(target) {
        sidebar.classList.add('active');
        tabBtns.forEach(b => {
            if (b.dataset.target === target) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
        tabContents.forEach(c => {
            if (c.id === target) {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });
    }

    if (toggleParticipantsBtn) {
        toggleParticipantsBtn.onclick = () => {
            if (sidebar.classList.contains('active') && document.getElementById('participants').classList.contains('active')) {
                sidebar.classList.remove('active');
            } else {
                openSidebarTab('participants');
            }
        };
    }

    if (toggleChatBtn) {
        toggleChatBtn.onclick = () => {
            if (sidebar.classList.contains('active') && document.getElementById('chat').classList.contains('active')) {
                sidebar.classList.remove('active');
            } else {
                openSidebarTab('chat');
            }
        };
    }

    if (meetingCodeEl) meetingCodeEl.textContent = formatMeetingCode(roomName);
    const lobbyMeetingCode = document.getElementById('lobbyMeetingCode');
    if (lobbyMeetingCode) lobbyMeetingCode.textContent = formatMeetingCode(roomName);

    // Copy meeting code
    const copyBtn = document.getElementById('copyMeetingCode');
    if (copyBtn) {
        copyBtn.onclick = () => {
            const formattedCode = formatMeetingCode(roomName);
            navigator.clipboard.writeText(formattedCode).then(() => {
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = ICONS.check;
                setTimeout(() => copyBtn.innerHTML = originalHTML, 2000);
            });
        };
    }

    // SVG Constants
    const ICONS = {
        mic: `<svg viewBox="0 0 24 24" class="lucide lucide-mic"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
        micOff: `<svg viewBox="0 0 24 24" class="lucide lucide-mic-off"><line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 1 5 11v-1"/><path d="M9 10.12V5a3 3 0 0 1 5.91-.74"/><polyline points="15 9.34 15 11 15 11"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
        video: `<svg viewBox="0 0 24 24" class="lucide lucide-video"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>`,
        videoOff: `<svg viewBox="0 0 24 24" class="lucide lucide-video-off"><path d="M10.66 6H14a2 2 0 0 1 2 2v2.34"/><path d="m22 8-6 4 6 4V8Z"/><path d="M2 2l20 20"/><path d="M2 8.22V16a2 2 0 0 0 2 2h12"/></svg>`,
        hand: `<svg viewBox="0 0 24 24" class="lucide lucide-hand"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M18 8a2 2 0 0 1 2 2v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-1.3-6.6-4.4L2 13.6a2 2 0 0 1 0-2.8v0a2 2 0 0 1 2.8 0l2.2 2.2"/></svg>`,
        copy: `<svg viewBox="0 0 24 24" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
        check: `<svg viewBox="0 0 24 24" class="lucide lucide-check"><polyline points="20 6 9 17 4 12"/></svg>`,
        host: `<svg viewBox="0 0 24 24" class="lucide lucide-shield" style="width: 14px; height: 14px; margin-right: 4px; display: inline; vertical-align: text-bottom;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        lock: `<svg viewBox="0 0 24 24" class="lucide lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
        unlock: `<svg viewBox="0 0 24 24" class="lucide lucide-unlock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
        kick: `<svg viewBox="0 0 24 24" class="lucide lucide-user-x"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="18" x2="22" y1="8" y2="12"/><line x1="22" x2="18" y1="8" y2="12"/></svg>`
    };

    let isMeetingLocked = false;
    let hostId = null;
    let userSession = JSON.parse(sessionStorage.getItem(getSessionKey())) || { name: 'Anonymous', userId: 'temp_' + Math.random() };
    const socket = io();

    // Check Meeting Status
    async function checkMeetingStatus() {
        try {
            const res = await fetch('/api/meeting/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meetingId: roomName })
            });
            const data = await res.json();
            if (data.success) {
                isMeetingLocked = data.isLocked;
                hostId = data.hostId;
                
                const isHost = userSession.userId === hostId;
                if (isHost) {
                    toggleLockBtn.style.display = 'flex';
                    hostControlsTabBtn.style.display = 'block';
                    document.getElementById('hostLobbyControls').style.display = 'block';
                    updateLockIcon(isMeetingLocked);
                }

                if (isMeetingLocked && !isHost) {
                    const joinBtn = document.getElementById('btnJoinNow');
                    joinBtn.textContent = 'Request to Join';
                    joinBtn.classList.add('requesting');
                    console.log('Meeting is locked, user must request join');
                }
                
                initPreJoin();
                socket.emit('join-room', roomName, userSession);
            } else {
                alert('Meeting not found');
                window.location.href = '/dashboard';
            }
        } catch (e) {
            console.error('Error checking meeting status:', e);
        }
    }

    function updateLockIcon(locked) {
        lockIcon.innerHTML = locked ? ICONS.lock : ICONS.unlock;
        toggleLockBtn.title = locked ? 'Unlock Meeting' : 'Lock Meeting';
        
        if (hostDropdownLockBtn) {
            hostDropdownLockBtn.innerHTML = locked ? 
                `${ICONS.unlock} Unlock Meeting` : 
                `${ICONS.lock} Lock Meeting`;
        }

        const lobbyLockIcon = document.getElementById('lobbyLockIcon');
        if (lobbyLockIcon) {
            lobbyLockIcon.innerHTML = locked ? ICONS.lock : ICONS.unlock;
        }
    }

    const toggleLockHandler = async () => {
        const newState = !isMeetingLocked;
        try {
            const res = await fetch('/api/meeting/toggle-lock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meetingId: roomName, isLocked: newState })
            });
            const data = await res.json();
            if (data.success) {
                isMeetingLocked = newState;
                updateLockIcon(isMeetingLocked);
                socket.emit('toggle-lock', isMeetingLocked);
            }
        } catch (e) {
            console.error('Error toggling lock:', e);
        }
    };

    toggleLockBtn.onclick = toggleLockHandler;
    const lobbyToggleLock = document.getElementById('lobbyToggleLock');
    if (lobbyToggleLock) lobbyToggleLock.onclick = toggleLockHandler;

    btnRequestJoin.onclick = () => {
        requestStatus.textContent = 'Request sent, waiting for host...';
        btnRequestJoin.disabled = true;
        socket.emit('request-to-join', {
            userId: userSession.userId,
            name: userSession.name,
            picture: userSession.picture
        });
    };

    document.getElementById('btnBackToDashboard').onclick = () => {
        window.location.href = '/dashboard';
    };

    socket.on('join-response', ({ allowed }) => {
        const statusEl = document.getElementById('lobbyRequestStatus');
        const joinBtn = document.getElementById('btnJoinNow');
        
        if (allowed) {
            if (statusEl) statusEl.textContent = 'Approved! Joining...';
            setTimeout(() => {
                if (statusEl) statusEl.style.display = 'none';
                document.getElementById('preJoinLobby').style.display = 'none';
                document.getElementById('mainRoomContainer').style.display = 'flex';
                joinRoom();
            }, 1500);
        } else {
            if (statusEl) statusEl.textContent = 'Request denied by host.';
            if (joinBtn) joinBtn.disabled = false;
        }
    });

    socket.on('join-request', (data) => {
        // 1. Popup Notification
        const requestDiv = document.createElement('div');
        requestDiv.className = 'glass-card';
        requestDiv.style.pointerEvents = 'auto';
        requestDiv.style.padding = '15px';
        requestDiv.style.width = '300px';
        requestDiv.style.border = '1px solid var(--accent-color)';
        requestDiv.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 10px;">Join Request</div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                <img src="${data.picture || 'https://ui-avatars.com/api/?name=' + data.name}" style="width: 40px; height: 40px; border-radius: 50%;">
                <span>${data.name} wants to join</span>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn-primary approve-btn" style="flex: 1; padding: 5px;">Allow</button>
                <button class="btn-secondary deny-btn" style="flex: 1; padding: 5px;">Deny</button>
            </div>
        `;
        joinRequestsContainer.appendChild(requestDiv);

        // 2. Sidebar List Item
        const sidebarReqList = document.getElementById('pendingRequestsList');
        const sidebarReqItems = document.getElementById('requestsItems');
        if (sidebarReqList) sidebarReqList.style.display = 'block';
        
        const sidebarItem = document.createElement('div');
        sidebarItem.className = 'glass-card';
        sidebarItem.style.padding = '8px';
        sidebarItem.style.fontSize = '0.85rem';
        sidebarItem.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>${data.name}</span>
                <div style="display: flex; gap: 4px;">
                    <button class="approve-btn control-btn" style="width: 24px; height: 24px; padding: 4px;">${ICONS.check}</button>
                    <button class="deny-btn control-btn danger" style="width: 24px; height: 24px; padding: 4px;">X</button>
                </div>
            </div>
        `;
        sidebarReqItems.appendChild(sidebarItem);

        const handleResponse = (allowed) => {
            socket.emit('join-response', { targetSocketId: data.socketId, allowed });
            requestDiv.remove();
            sidebarItem.remove();
            if (sidebarReqItems.children.length === 0) sidebarReqList.style.display = 'none';
        };

        requestDiv.querySelector('.approve-btn').onclick = () => handleResponse(true);
        requestDiv.querySelector('.deny-btn').onclick = () => handleResponse(false);
        sidebarItem.querySelector('.approve-btn').onclick = () => handleResponse(true);
        sidebarItem.querySelector('.deny-btn').onclick = () => handleResponse(false);
    });

    socket.on('kicked', () => {
        alert('You have been removed from the meeting by the host.');
        window.location.href = '/dashboard';
    });

    socket.on('user-kicked', ({ userId, name }) => {
        addSystemMessage(`${name} was removed from the meeting`);
        const el = document.getElementById(`user-list-${userId}`);
        if (el) el.remove();
    });

    socket.on('lock-status-updated', ({ isLocked }) => {
        isMeetingLocked = isLocked;
        if (userSession.userId === hostId) {
            updateLockIcon(isLocked);
        }
    });

    muteAllBtn.onclick = () => {
        if (confirm('Are you sure you want to mute everyone?')) {
            socket.emit('mute-all');
        }
    };

    socket.on('remote-mute-request', ({ targetUserId, all }) => {
        if (all || targetUserId === userSession.userId) {
            if (userSession.userId === hostId && all) return; // Don't mute host if 'mute all'
            
            room.localParticipant.setMicrophoneEnabled(false);
            const micBtn = document.getElementById('toggleMic');
            micBtn.classList.add('active');
            micBtn.innerHTML = ICONS.micOff;
            updateMuteUI(userSession.userId, true);
            
            // Notification
            const toast = document.createElement('div');
            toast.className = 'glass-card';
            toast.style.position = 'fixed';
            toast.style.bottom = '100px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.padding = '10px 20px';
            toast.style.zIndex = '5000';
            toast.textContent = 'The host has muted your microphone.';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    });

    // Socket.io and Session Initialization
    // (Already initialized above)


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
        console.log('initPreJoin called');
        const lobbyVideo = document.getElementById('lobbyVideoPreview');
        const emptyAvatar = document.querySelector('.lobby-empty-avatar');
        const lobbyMicBtn = document.getElementById('lobbyToggleMic');
        const lobbyCamBtn = document.getElementById('lobbyToggleCam');
        document.getElementById('lobbyMeetingCode').textContent = roomName;

        lobbyMicBtn.innerHTML = ICONS.mic;
        lobbyCamBtn.innerHTML = ICONS.video;
        lobbyMicBtn.classList.add('active');
        lobbyCamBtn.classList.add('active');
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

                const lobbyAvatar = document.getElementById('lobbyInitialsAvatar');
                if (lobbyAvatar) lobbyAvatar.style.display = 'none';
            } catch (err) {
                console.error("Error accessing media devices.", err);
                emptyAvatar.style.display = 'flex';
                lobbyVideo.style.display = 'none';
                isLobbyCamEnabled = false;
                isLobbyMicEnabled = false;
                
                const lobbyAvatar = document.getElementById('lobbyInitialsAvatar');
                if (lobbyAvatar) lobbyAvatar.style.display = 'none';

                lobbyMicBtn.classList.add('off');
                lobbyCamBtn.classList.add('off');
                lobbyMicBtn.innerHTML = ICONS.micOff;
                lobbyCamBtn.innerHTML = ICONS.videoOff;
            }
        }

        lobbyMicBtn.onclick = () => {
            isLobbyMicEnabled = !isLobbyMicEnabled;
            lobbyMicBtn.classList.toggle('on', isLobbyMicEnabled);
            lobbyMicBtn.classList.toggle('off', !isLobbyMicEnabled);
            lobbyMicBtn.innerHTML = isLobbyMicEnabled ? ICONS.mic : ICONS.micOff;
            lobbyMicBtn.title = isLobbyMicEnabled ? 'Mute' : 'Unmute';
            if (localStream && localStream.getAudioTracks().length > 0) {
                localStream.getAudioTracks()[0].enabled = isLobbyMicEnabled;
            }
        };

        lobbyCamBtn.onclick = async () => {
            isLobbyCamEnabled = !isLobbyCamEnabled;
            lobbyCamBtn.classList.toggle('on', isLobbyCamEnabled);
            lobbyCamBtn.classList.toggle('off', !isLobbyCamEnabled);
            lobbyCamBtn.innerHTML = isLobbyCamEnabled ? ICONS.video : ICONS.videoOff;
            lobbyCamBtn.title = isLobbyCamEnabled ? 'Stop Video' : 'Start Video';

            if (isLobbyCamEnabled) {
                await startPreview();
            } else {
                if (localStream && localStream.getVideoTracks().length > 0) {
                    localStream.getVideoTracks().forEach(t => t.stop());
                }
                
                // Show initials avatar in lobby
                let lobbyAvatar = document.getElementById('lobbyInitialsAvatar');
                if (!lobbyAvatar) {
                    lobbyAvatar = createAvatarElement(userSession);
                    lobbyAvatar.id = 'lobbyInitialsAvatar';
                    document.querySelector('.lobby-video-container').appendChild(lobbyAvatar);
                }
                lobbyAvatar.style.display = 'flex';
                lobbyAvatar.style.opacity = '1';
                lobbyAvatar.style.transform = 'scale(1)';
                
                emptyAvatar.style.display = 'none'; // Hide the default SVG
                lobbyVideo.style.display = 'none';
            }
        };

        document.getElementById('btnJoinNow').onclick = () => {
            const newName = document.getElementById('lobbyNameInput').value.trim();
            if (newName) {
                userSession.name = newName;
                sessionStorage.setItem(getSessionKey(), JSON.stringify(userSession));
                socket.emit('change-name', newName);
            }

            const isHost = userSession.userId === hostId;
            if (isMeetingLocked && !isHost) {
                const joinBtn = document.getElementById('btnJoinNow');
                const statusEl = document.getElementById('lobbyRequestStatus');
                joinBtn.disabled = true;
                statusEl.style.display = 'block';
                statusEl.textContent = 'Request sent, waiting for host...';
                
                socket.emit('request-to-join', {
                    userId: userSession.userId,
                    name: userSession.name,
                    picture: userSession.picture
                });
                return;
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

    function createAvatarElement(user) {
        const container = document.createElement('div');
        container.className = 'avatar-container';
        container.id = `avatar-${user.userId || user.identity}`;
        
        const circle = document.createElement('div');
        circle.className = 'avatar-circle';
        
        const name = user.name || 'Anonymous';
        if (user.picture) {
            circle.style.backgroundImage = `url(${user.picture})`;
        } else {
            const initials = name.split(' ').map(n => n[0]).join('').substr(0, 2).toUpperCase();
            circle.textContent = initials || '?';
            const colors = ['#2ea043', '#58a6ff', '#8b949e', '#f85149', '#d29922'];
            const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
            circle.style.backgroundColor = colors[charCodeSum % colors.length];
        }
        
        container.appendChild(circle);
        return container;
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
                    let wrapper = document.getElementById(`wrapper-${participant.identity}`);
                    if (!wrapper) {
                        wrapper = document.createElement('div');
                        wrapper.id = `wrapper-${participant.identity}`;
                        wrapper.className = 'video-wrapper';

                        const avatar = createAvatarElement({ userId: participant.identity, name: participant.name });
                        wrapper.appendChild(avatar);

                        const netIndicator = document.createElement('div');
                        netIndicator.className = 'network-indicator';
                        netIndicator.id = `net-${participant.identity}`;
                        netIndicator.innerHTML = `
                            <div class="network-bar"></div>
                            <div class="network-bar"></div>
                            <div class="network-bar"></div>
                            <div class="network-bar"></div>
                        `;
                        netIndicator.title = 'Excellent connection';
                        wrapper.appendChild(netIndicator);

                        const nameLabel = document.createElement('div');
                        nameLabel.className = 'participant-label';
                        nameLabel.id = `label-${participant.identity}`;
                        updateParticipantLabel(nameLabel, participant.name, participant.identity === hostId);
                        wrapper.appendChild(nameLabel);

                        document.getElementById('video-grid').appendChild(wrapper);
                        setupZoom(wrapper);
                    }
                    
                    const existingVid = wrapper.querySelector('video');
                    if (existingVid) existingVid.remove();
                    
                    const element = track.attach();
                    wrapper.appendChild(element); // Video attached to wrapper, now behind label
                    
                    // Check if already muted or video off
                    const audioPub = participant.getTrackPublication(LivekitClient.Track.Source.Microphone);
                    if (audioPub && audioPub.isMuted) updateMuteUI(participant.identity, true);
                    
                    const videoPub = participant.getTrackPublication(LivekitClient.Track.Source.Camera);
                    if (videoPub && videoPub.isMuted) {
                        wrapper.classList.add('camera-off');
                    }
                } else if (track.kind === LivekitClient.Track.Kind.Audio) {
                    document.body.appendChild(track.attach());
                }
            });

            room.on(LivekitClient.RoomEvent.TrackMuted, (publication, participant) => {
                if (publication.kind === LivekitClient.Track.Kind.Audio) {
                    updateMuteUI(participant.identity, true);
                } else if (publication.kind === LivekitClient.Track.Kind.Camera) {
                    const wrapper = document.getElementById(`wrapper-${participant.identity}`);
                    if (wrapper) wrapper.classList.add('camera-off');
                }
            });

            room.on(LivekitClient.RoomEvent.TrackUnmuted, (publication, participant) => {
                if (publication.kind === LivekitClient.Track.Kind.Audio) {
                    updateMuteUI(participant.identity, false);
                } else if (publication.kind === LivekitClient.Track.Kind.Camera) {
                    const wrapper = document.getElementById(`wrapper-${participant.identity}`);
                    if (wrapper) wrapper.classList.remove('camera-off');
                }
            });

            room.on(LivekitClient.RoomEvent.ConnectionQualityChanged, (quality, participant) => {
                updateNetworkIndicator(participant.identity, quality);
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

            mainMicBtn.classList.toggle('on', isLobbyMicEnabled);
            mainMicBtn.classList.toggle('off', !isLobbyMicEnabled);
            mainMicBtn.innerHTML = isLobbyMicEnabled ? ICONS.mic : ICONS.micOff;
            mainMicBtn.title = isLobbyMicEnabled ? 'Mute' : 'Unmute';

            mainCamBtn.classList.toggle('on', isLobbyCamEnabled);
            mainCamBtn.classList.toggle('off', !isLobbyCamEnabled);
            mainCamBtn.innerHTML = isLobbyCamEnabled ? ICONS.video : ICONS.videoOff;
            mainCamBtn.title = isLobbyCamEnabled ? 'Stop Video' : 'Start Video';

            // Local Wrapper and Video/Avatar
            let wrapper = document.getElementById(`wrapper-${userSession.userId}`);
            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.id = `wrapper-${userSession.userId}`;
                wrapper.className = 'video-wrapper';
                if (!isLobbyCamEnabled) wrapper.classList.add('camera-off');

                const avatar = createAvatarElement(userSession);
                wrapper.appendChild(avatar);

                const netIndicator = document.createElement('div');
                netIndicator.className = 'network-indicator';
                netIndicator.id = `net-${userSession.userId}`;
                netIndicator.innerHTML = `
                    <div class="network-bar"></div>
                    <div class="network-bar"></div>
                    <div class="network-bar"></div>
                    <div class="network-bar"></div>
                `;
                netIndicator.title = 'Excellent connection';
                wrapper.appendChild(netIndicator);
                updateNetworkIndicator(userSession.userId, room.localParticipant.connectionQuality);

                const nameLabel = document.createElement('div');
                nameLabel.className = 'participant-label';
                nameLabel.id = `label-${userSession.userId}`;
                updateParticipantLabel(nameLabel, userSession.name + ' (You)', userSession.userId === hostId);
                wrapper.appendChild(nameLabel);
                
                document.getElementById('video-grid').appendChild(wrapper);
                setupZoom(wrapper);
            }

            if (isLobbyCamEnabled) {
                const localVideoTrack = room.localParticipant.getTrackPublication(LivekitClient.Track.Source.Camera);
                if (localVideoTrack && localVideoTrack.videoTrack) {
                    const element = localVideoTrack.videoTrack.attach();
                    wrapper.insertBefore(element, wrapper.firstChild);
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
                    btn.classList.toggle('off', enabled);
                    btn.classList.toggle('on', !enabled);
                    btn.innerHTML = !enabled ? ICONS.mic : ICONS.micOff;
                    btn.title = !enabled ? 'Mute' : 'Unmute';
                    updateMuteUI(userSession.userId, enabled);
                } catch (err) {
                    console.error('Error toggling mic:', err);
                }
            };
            document.getElementById('toggleVideo').onclick = async () => {
                const enabled = room.localParticipant.isCameraEnabled;
                try {
                    await room.localParticipant.setCameraEnabled(!enabled);
                    const btn = document.getElementById('toggleVideo');
                    btn.classList.toggle('off', enabled);
                    btn.classList.toggle('on', !enabled);
                    btn.innerHTML = !enabled ? ICONS.video : ICONS.videoOff;
                    btn.title = !enabled ? 'Stop Video' : 'Start Video';

                    let wrapper = document.getElementById(`wrapper-${userSession.userId}`);
                    if (wrapper) {
                        wrapper.classList.toggle('camera-off', enabled);
                        if (!enabled) { // Turned camera ON
                            const pub = room.localParticipant.getTrackPublication(LivekitClient.Track.Source.Camera);
                            if (pub && pub.videoTrack) {
                                const existingVid = wrapper.querySelector('video');
                                if (existingVid) existingVid.remove();
                                const element = pub.videoTrack.attach();
                                wrapper.appendChild(element); // Ensure it's behind label
                            }
                        }
                    } else {
                        // If wrapper didn't exist (camera was off), create it
                        wrapper = document.createElement('div');
                        wrapper.id = `wrapper-${userSession.userId}`;
                        wrapper.className = 'video-wrapper';
                        
                        const avatar = createAvatarElement(userSession);
                        wrapper.appendChild(avatar);

                        const nameLabel = document.createElement('div');
                        nameLabel.className = 'participant-label';
                        nameLabel.id = `label-${userSession.userId}`;
                        updateParticipantLabel(nameLabel, userSession.name + ' (You)', userSession.userId === hostId);
                        
                        const pub = room.localParticipant.getTrackPublication(LivekitClient.Track.Source.Camera);
                        if (pub && pub.videoTrack) {
                            const element = pub.videoTrack.attach();
                            wrapper.appendChild(element);
                        }
                        
                        wrapper.appendChild(nameLabel);
                        document.getElementById('video-grid').appendChild(wrapper);
                        setupZoom(wrapper);
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

    checkMeetingStatus();

    let isHandRaised = false;

    // Socket Events
    // socket.emit('join-room', roomName, userSession); // This will be emitted inside joinRoom now to ensure it happens AFTER LiveKit connect if needed, or keep it here.
    // Actually, join-room handles the "Lobby" sync too, so keep it.
    // socket.emit('join-room', roomName, userSession);


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
        
        // Show/Hide Host Controls Tab
        if (hostControlsTabBtn) {
            hostControlsTabBtn.style.display = userSession.userId === hostId ? 'block' : 'none';
        }

        // Update labels
        const localLabel = document.getElementById(`label-${userSession.userId}`);
        if (localLabel) updateParticipantLabel(localLabel, userSession.name + ' (You)', userSession.userId === hostId);

        participantsList.innerHTML = '';

        // Sync Host Controls panel toggles
        if (userSession.userId === hostId) {
            const shareToggle = document.getElementById('allowScreenShareAll');
            const wbToggle = document.getElementById('allowWhiteboardAll');
            if (shareToggle) shareToggle.checked = isScreenShareAllowed;
            if (wbToggle) wbToggle.checked = isWhiteboardAllowedForAll;
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

        // Sidebar list sync
        const listMic = document.getElementById(`list-mic-${userId}`);
        if (listMic) {
            listMic.innerHTML = isMuted ? ICONS.micOff : ICONS.mic;
            listMic.classList.toggle('off', isMuted);
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

    // Sub-tab switching logic for Participants
    const subTabBtns = document.querySelectorAll('.sub-tab-btn');
    const subTabContents = document.querySelectorAll('.sub-tab-content');

    subTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-sub-target');
            
            // Update buttons
            subTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update contents
            subTabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetId) {
                    content.classList.add('active');
                }
            });
        });
    });

    function addParticipantToList(user) {
        if (document.getElementById(`user-list-${user.userId}`)) return;
        const div = document.createElement('div');
        div.id = `user-list-${user.userId}`;
        div.className = 'participant-item';
        
        const isTargetHost = user.userId === hostId;

        // Icons
        const micIcon = document.createElement('div');
        micIcon.id = `list-mic-${user.userId}`;
        micIcon.className = 'participant-action-icon';
        micIcon.innerHTML = ICONS.mic;

        const videoIcon = document.createElement('div');
        videoIcon.id = `list-video-${user.userId}`;
        videoIcon.className = 'participant-action-icon';
        videoIcon.innerHTML = ICONS.video;

        div.innerHTML = `
            <div class="participant-info">
                <div class="participant-avatar" id="list-avatar-wrapper-${user.userId}">
                    <!-- Avatar will be inserted here -->
                </div>
                <span class="participant-name">
                    ${user.name}${user.userId === userSession.userId ? ' (You)' : ''}${isTargetHost ? ' (Host)' : ''}
                </span>
            </div>
            <div class="participant-actions">
                <div id="list-hand-${user.userId}" class="participant-action-icon" style="display: none; color: var(--accent-color);">
                    ${ICONS.hand}
                </div>
                <div id="list-mic-container-${user.userId}"></div>
                <div id="list-video-container-${user.userId}"></div>
            </div>
        `;

        document.getElementById('participantsList').appendChild(div);
        
        // Append avatar
        const avatar = createAvatarElement(user);
        document.getElementById(`list-avatar-wrapper-${user.userId}`).appendChild(avatar);
        
        // Append icons
        document.getElementById(`list-mic-container-${user.userId}`).appendChild(micIcon);
        document.getElementById(`list-video-container-${user.userId}`).appendChild(videoIcon);
    }

    function updateNetworkIndicator(userId, quality) {
        const netEl = document.getElementById(`net-${userId}`);
        if (!netEl) return;
        
        const bars = netEl.querySelectorAll('.network-bar');
        bars.forEach(b => {
            b.classList.remove('active', 'warning', 'danger');
        });

        let activeCount = 0;
        let colorClass = '';
        let tooltip = '';

        if (quality === LivekitClient.ConnectionQuality.Excellent) {
            activeCount = 4;
            tooltip = 'Excellent connection';
        } else if (quality === LivekitClient.ConnectionQuality.Good) {
            activeCount = 3;
            tooltip = 'Good connection';
        } else if (quality === LivekitClient.ConnectionQuality.Poor) {
            activeCount = 2;
            colorClass = 'warning';
            tooltip = 'Weak connection';
        } else if (quality === LivekitClient.ConnectionQuality.Lost) {
            activeCount = 1;
            colorClass = 'danger';
            tooltip = 'Poor connection';
        }

        for (let i = 0; i < activeCount; i++) {
            bars[i].classList.add('active');
            if (colorClass) bars[i].classList.add(colorClass);
        }
        netEl.title = tooltip;
    }

    function addSystemMessage(text) {
        const div = document.createElement('div');
        div.className = 'system-msg';
        div.textContent = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    checkMeetingStatus();
});
