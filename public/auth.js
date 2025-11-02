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

        // TODO: Replace with actual authentication API call
        console.log('Login attempt:', { email, password, role });

        // Simulate successful login
        localStorage.setItem('user', JSON.stringify({ 
            email, 
            name: email.split('@')[0],
            role: role,
            loggedIn: true 
        }));
        
        // Redirect to dashboard
        window.location.href = 'dashboard.html';
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

        // TODO: Replace with actual registration API call
        console.log('Signup attempt:', { name, email, password, role });

        // Simulate successful signup
        localStorage.setItem('user', JSON.stringify({ 
            email, 
            name,
            role: role,
            loggedIn: true 
        }));
        
        // Redirect to dashboard
        window.location.href = 'dashboard.html';
    });
});
