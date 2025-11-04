// Authentication JavaScript

document.addEventListener('DOMContentLoaded', () => {
    const showSignupBtn = document.getElementById('show-signup');
    const showLoginBtn = document.getElementById('show-login');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginFormElement = document.getElementById('loginForm');
    const signupFormElement = document.getElementById('signupForm');

    // Switch to signup form
    showSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.remove('active');
        signupForm.classList.add('active');
    });

    // Switch to login form
    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.classList.remove('active');
        loginForm.classList.add('active');
    });

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

            const result = await response.json();

            if (result.success) {
                // Store user data and server-issued session token
                localStorage.setItem('user', JSON.stringify({ 
                    email: result.user.email,
                    name: result.user.name,
                    operatorId: result.user.operatorId,
                    role: role,
                    loggedIn: true,
                    sessionToken: result.sessionToken,
                    expiresAt: result.expiresAt,
                    loginTime: new Date().toISOString()
                }));
                
                // Also store sessionToken separately for easy access
                localStorage.setItem('sessionToken', result.sessionToken);
                
                console.log('✅ Login successful with server session');
                console.log('Operator ID:', result.user.operatorId);
                
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            } else {
                alert('Login failed: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Network error during login. Please try again.');
        }
    });

    // Handle signup
    signupFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-confirm').value;
        const role = document.getElementById('signup-role').value;

        // Validate passwords match
        if (password !== confirm) {
            alert('Passwords do not match!');
            return;
        }

        try {
            // Call server-side authentication API
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const result = await response.json();

            if (result.success) {
                // Store user data and server-issued session token
                localStorage.setItem('user', JSON.stringify({ 
                    email: result.user.email,
                    name: result.user.name,
                    operatorId: result.user.operatorId,
                    role: role,
                    loggedIn: true,
                    sessionToken: result.sessionToken,
                    expiresAt: result.expiresAt,
                    loginTime: new Date().toISOString()
                }));
                
                // Also store sessionToken separately for easy access
                localStorage.setItem('sessionToken', result.sessionToken);
                
                console.log('✅ Signup successful with server session');
                console.log('Operator ID:', result.user.operatorId);
                
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            } else {
                alert('Signup failed: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Signup error:', error);
            alert('Network error during signup. Please try again.');
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
