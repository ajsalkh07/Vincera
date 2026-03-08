// auth.js - Authentication handlers for VINCERA

function getTabId() {
    // If window.name is empty or doesn't have our prefix, it's a new or unknown tab.
    if (!window.name || !window.name.startsWith('vincera_tab_')) {
        window.name = 'vincera_tab_' + Math.random().toString(36).substr(2, 9);
        console.log('New Tab ID generated:', window.name);
    }
    return window.name;
}

// Crucial: Call this before storing a NEW session to ensure this tab uses a unique key
function resetTabId() {
    const oldId = window.name;
    window.name = 'vincera_tab_' + Math.random().toString(36).substr(2, 9);
    console.log('Tab ID reset from', oldId, 'to', window.name);
    return window.name;
}

function getSessionKey() {
    return `userSession_${getTabId()}`;
}

// Ensure login page always starts with a fresh Tab ID to prevent identity inheritance
if (window.location.pathname === '/' || window.location.pathname === '/login.html') {
    resetTabId();
}

function handleCredentialResponse(response) {
    // response.credential is the JWT ID Token from Google
    fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: response.credential })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Force a new Tab ID to prevent collision with any cloned tabs
                resetTabId();
                sessionStorage.setItem(getSessionKey(), JSON.stringify(data.user));
                window.location.href = '/dashboard';
            } else {
                alert('Google Login Failed: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(err => console.error('Error during Google login:', err));
}

async function handleEmailLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password');

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: password.value })
        });
        const data = await res.json();
        if (data.success) {
            // Force a new Tab ID to prevent collision with any cloned tabs
            resetTabId();
            sessionStorage.setItem(getSessionKey(), JSON.stringify(data.user));
            window.location.href = '/dashboard';
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (err) {
        console.error('Login error:', err);
    }
}

async function handleEmailRegister(event) {
    event.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (data.success) {
            // Force a new Tab ID to prevent collision with any cloned tabs
            resetTabId();
            sessionStorage.setItem(getSessionKey(), JSON.stringify(data.user));
            window.location.href = '/dashboard';
        } else {
            alert(data.error || 'Registration failed');
        }
    } catch (err) {
        console.error('Registration error:', err);
    }
}

function checkAuth() {
    const session = sessionStorage.getItem(getSessionKey());
    if (!session) {
        window.location.href = '/';
        return false;
    }
    const user = JSON.parse(session);
    const avatarEl = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    if (avatarEl && user.picture) avatarEl.src = user.picture;
    if (nameEl) nameEl.textContent = user.name;
    return true;
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem(getSessionKey());
        // Clear session cookie
        document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        window.location.href = '/';
    });
}
