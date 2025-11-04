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

    // Set user name and operator ID
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
        if (user.operatorId && user.operatorId.startsWith('OP')) {
            // Display: OP001 - Name
            userNameElement.innerHTML = `<span style="color: #2196F3; font-weight: bold;">${user.operatorId}</span> - ${user.name || user.email}`;
        } else {
            userNameElement.textContent = user.name || user.email;
        }
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

    // Task history filter and refresh
    const taskTypeFilter = document.getElementById('task-type-filter');
    const refreshBtn = document.getElementById('refresh-history');
    
    if (taskTypeFilter) {
        taskTypeFilter.addEventListener('change', () => loadTaskHistory());
    }
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadTaskHistory());
    }
});

// Load task history
async function loadTaskHistory() {
    // Get session token from user object OR separate localStorage (backwards compatibility)
    const user = JSON.parse(localStorage.getItem('user'));
    const sessionToken = user?.sessionToken || localStorage.getItem('sessionToken');
    const taskType = document.getElementById('task-type-filter')?.value || '';
    const historyList = document.getElementById('task-history-list');
    
    if (!historyList) {
        console.error('Task history list element not found');
        return;
    }
    
    if (!sessionToken) {
        historyList.innerHTML = '<p style="text-align: center; color: #f44336; padding: 20px;">⚠️ Please log out and log in again to view task history</p>';
        console.error('No session token found. User object:', user);
        console.error('Please logout and login again to get a fresh session token');
        return;
    }
    
    console.log('✅ Session token found, loading task history...');
    
    try {
        historyList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Loading task history...</p>';
        
        // Build query parameters
        const params = new URLSearchParams({
            sessionToken: sessionToken,
            limit: '50'
        });
        
        if (taskType) {
            params.append('taskType', taskType);
        }
        
        console.log('Fetching task history with params:', params.toString());
        const response = await fetch(`/api/task-history?${params}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Task history response:', data);
        
        if (data.success && data.taskHistory && data.taskHistory.length > 0) {
            historyList.innerHTML = '';
            
            data.taskHistory.forEach(task => {
                const taskItem = document.createElement('div');
                taskItem.className = 'task-history-item';
                taskItem.style.cssText = 'border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 10px; background: #f9f9f9;';
                
                // Format date
                const completedDate = new Date(task.completed_at);
                const dateStr = completedDate.toLocaleDateString();
                const timeStr = completedDate.toLocaleTimeString();
                
                // Task type badge
                const typeBadge = task.task_type === 'incoming' 
                    ? '<span style="background: #4CAF50; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px;">📥 Incoming</span>'
                    : '<span style="background: #2196F3; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px;">📤 Outgoing</span>';
                
                // Ensure operator_id is displayed in OP00X format
                const displayOperatorId = task.operator_id || 'N/A';
                const displayOperatorName = task.operator_name || 'Unknown Operator';
                
                taskItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div>
                            <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">
                                <span style="color: #2196F3;">${displayOperatorId}</span> - ${displayOperatorName}
                            </div>
                            <div style="color: #666; font-size: 14px;">
                                ${typeBadge} SKU: <strong>${task.sku}</strong> | Qty: <strong>${task.quantity}</strong> CFC
                            </div>
                        </div>
                        <div style="text-align: right; font-size: 12px; color: #666;">
                            <div>${dateStr}</div>
                            <div>${timeStr}</div>
                        </div>
                    </div>
                    <div style="font-size: 12px; color: #666; margin-top: 8px;">
                        <div><strong>Bins Used:</strong> ${task.bins_used || 'N/A'}</div>
                        <div><strong>Duration:</strong> ${task.duration_minutes} minutes</div>
                        <div><strong>Status:</strong> <span style="color: #4CAF50;">✓ ${task.status}</span></div>
                    </div>
                `;
                
                historyList.appendChild(taskItem);
            });
        } else {
            historyList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No task history found.</p>';
        }
    } catch (error) {
        console.error('Error loading task history:', error);
        historyList.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">Error loading task history. Please try again.</p>';
    }
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
        
        // Update stats with IDs
        const activeBinsEl = document.getElementById('stat-active-bins');
        const skuTypesEl = document.getElementById('stat-sku-types');
        const totalUnitsEl = document.getElementById('stat-total-units');
        const emptyBinsEl = document.getElementById('stat-empty-bins');
        
        if (activeBinsEl) activeBinsEl.textContent = data.activeBins || '0';
        if (skuTypesEl) skuTypesEl.textContent = data.skuTypes || '0';
        if (totalUnitsEl) totalUnitsEl.textContent = data.totalUnits || '0';
        if (emptyBinsEl) emptyBinsEl.textContent = data.emptyBins || '0';
        
        console.log('Statistics loaded:', data);
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}
