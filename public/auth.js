// Authentication JavaScript

document.addEventListener('DOMContentLoaded', () => {
    const loginFormElement = document.getElementById('loginForm');

    // Handle login
    loginFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const role = document.getElementById('user-role').value;

        try {
            // Call server-side authentication API
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name: email.split('@')[0] })
            });

            // Handle server errors (502, 500, etc.)
            if (!response.ok) {
                if (response.status === 502) {
                    alert('⚠️ Server is temporarily unavailable (Bad Gateway). The server may be restarting after deployment. Please wait 30 seconds and try again.');
                } else if (response.status === 500) {
                    alert('⚠️ Server error occurred. Please try again in a moment.');
                } else {
                    alert(`⚠️ Server returned error: ${response.status} ${response.statusText}`);
                }
                return;
            }

            const result = await response.json();

            if (result.success) {
                // Store user data and server-issued session token
                localStorage.setItem('user', JSON.stringify({ 
                    operatorId: result.user.operatorId,
                    email: result.user.email,
                    name: result.user.name,
                    role: role,
                    loggedIn: true,
                    sessionToken: result.sessionToken,
                    expiresAt: result.expiresAt,
                    loginTime: new Date().toISOString()
                }));
                
                // Also store sessionToken separately for backwards compatibility
                localStorage.setItem('sessionToken', result.sessionToken);
                
                console.log('✅ Login successful with server session, Operator ID:', result.user.operatorId);
                
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            } else {
                alert('❌ Login failed: ' + (result.error || 'Invalid credentials'));
            }
        } catch (error) {
            console.error('Login error:', error);
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                alert('❌ Cannot connect to server. Please check your internet connection or try again later.');
            } else {
                alert('❌ Network error during login. The server may be restarting. Please wait 30 seconds and try again.');
            }
        }
    });
});

// Helper function for logout (can be called from other pages)
async function logoutUser() {
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (user && user.sessionToken) {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken: user.sessionToken })
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Validate session on page load (for protected pages)
async function validateSession() {
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!user || !user.sessionToken) {
        return false;
    }
    
    try {
        const response = await fetch('/api/auth/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: user.sessionToken })
        });
        
        const result = await response.json();
        
        if (result.valid) {
            // Update local storage with fresh data
            localStorage.setItem('user', JSON.stringify({
                ...user,
                expiresAt: result.expiresAt
            }));
            return true;
        } else {
            console.warn('Session validation failed:', result.reason);
            localStorage.removeItem('user');
            return false;
        }
    } catch (error) {
        console.error('Session validation error:', error);
        return false;
    }
}
