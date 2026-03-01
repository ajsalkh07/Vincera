// auth.js - Authentication handlers for VINCERA

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
                localStorage.setItem('userSession', JSON.stringify(data.user));
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
            localStorage.setItem('userSession', JSON.stringify(data.user));
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
            localStorage.setItem('userSession', JSON.stringify(data.user));
            window.location.href = '/dashboard';
        } else {
            alert(data.error || 'Registration failed');
        }
    } catch (err) {
        console.error('Registration error:', err);
    }
}

function checkAuth() {
    const session = localStorage.getItem('userSession');
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
        localStorage.removeItem('userSession');
        // Clear session cookie
        document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        window.location.href = '/';
    });
}
