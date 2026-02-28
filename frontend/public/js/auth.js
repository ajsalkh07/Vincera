// Handle mock login for testing since Google Auth is rejecting the Client ID
function handleMockLogin() {
    fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: 'mock-token-bypass' })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Save mock session data in localStorage just for the UI display
                localStorage.setItem('userSession', JSON.stringify(data.user));
                window.location.href = '/dashboard';
            } else {
                alert('Login failed');
            }
        })
        .catch(err => console.error('Error logging in:', err));
}

// Check if user is authenticated (simple client-side check)
function checkAuth() {
    const session = localStorage.getItem('userSession');
    if (!session) {
        window.location.href = '/';
        return false;
    }

    // Populate UI info if on dashboard
    const user = JSON.parse(session);
    const avatarEl = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    if (avatarEl) avatarEl.src = user.picture;
    if (nameEl) nameEl.textContent = user.name;

    return true;
}

// Logout handler
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('userSession');
        // Ideally should make a request to clear secure HttpOnly cookies here
        document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        window.location.href = '/';
    });
}
