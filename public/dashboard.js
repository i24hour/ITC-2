// Dashboard JavaScript

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.loggedIn) {
        window.location.href = 'index.html';
        return;
    }

    // Show supervisor section only for supervisors
    if (user.role === 'supervisor') {
        const supervisorSection = document.getElementById('supervisor-access');
        if (supervisorSection) {
            supervisorSection.style.display = 'block';
        }
    }

    // Set user name
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
        userNameElement.textContent = user.name || user.email;
    }

    // Logout handler
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    });

    // Load dashboard data
    loadTaskHistory();
    loadReminders();
    loadStats();
});

// Load task history
function loadTaskHistory() {
    // TODO: Fetch from API
    fetch('/api/reports/activity')
        .then(res => res.json())
        .then(data => {
            console.log('Task history loaded:', data);
            // Update UI with real data if needed
        })
        .catch(err => console.error('Error loading task history:', err));
}

// Load expiry reminders
function loadReminders() {
    // TODO: Fetch from API
    // Mock data is already in HTML
    console.log('Loading reminders...');
}

// Load quick statistics
async function loadStats() {
    try {
        const response = await fetch('/api/reports/summary');
        const data = await response.json();
        
        // Update stats
        const statCards = document.querySelectorAll('.stat-card');
        if (statCards[0]) statCards[0].querySelector('.stat-value').textContent = data.activeBins;
        if (statCards[1]) statCards[1].querySelector('.stat-value').textContent = data.skuTypes;
        if (statCards[2]) statCards[2].querySelector('.stat-value').textContent = data.totalUnits;
        if (statCards[3]) statCards[3].querySelector('.stat-value').textContent = data.emptyBins;
        
        console.log('Statistics loaded:', data);
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}
