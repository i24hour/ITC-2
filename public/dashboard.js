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
        
        // Show Reports card only for supervisors
        const reportsCard = document.getElementById('reports-card');
        if (reportsCard) {
            reportsCard.style.setProperty('display', 'flex', 'important');
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
    loadPendingTasks();

    // Refresh pending tasks every 10 seconds
    setInterval(loadPendingTasks, 10000);

    // Expiry filter change event
    const expiryFilter = document.getElementById('expiry-filter');
    if (expiryFilter) {
        expiryFilter.addEventListener('change', () => loadReminders());
    }

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
    console.log('✅ Filtering by operator ID:', user.operatorId);
    
    try {
        historyList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Loading task history...</p>';
        
        // Build query parameters
        const params = new URLSearchParams({
            sessionToken: sessionToken,
            limit: '50'
        });
        
        // Filter by logged-in operator's ID
        if (user.operatorId) {
            params.append('operatorId', user.operatorId);
        }
        
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
async function loadReminders() {
    const remindersList = document.getElementById('reminders-list');
    const filterValue = document.getElementById('expiry-filter')?.value || '15';
    
    if (!remindersList) return;
    
    try {
        remindersList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Loading expiry reminders...</p>';
        
        // Fetch inventory with expire_days
        const response = await fetch('/api/inventory/expiry-reminders?filter=' + filterValue);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Expiry reminders response:', data);
        
        if (data.success && data.items && data.items.length > 0) {
            remindersList.innerHTML = '';
            
            data.items.forEach(item => {
                const reminderItem = document.createElement('div');
                let itemClass = 'reminder-item';
                let icon = '🟢';
                
                // Color coding based on expire_days
                if (item.expire_days <= 2) {
                    itemClass += ' urgent';
                    icon = '🔴';
                } else if (item.expire_days <= 7) {
                    itemClass += ' warning';
                    icon = '🟡';
                } else {
                    itemClass += ' info';
                    icon = '🟢';
                }
                
                reminderItem.className = itemClass;
                reminderItem.innerHTML = `
                    <div class="reminder-icon">${icon}</div>
                    <div class="reminder-content">
                        <h4>${item.sku} - Bin ${item.bin_no}</h4>
                        <p style="margin: 5px 0;"><strong>Batch:</strong> ${item.batch_no}</p>
                        <p style="margin: 5px 0;"><strong>Description:</strong> ${item.description}</p>
                        <p style="margin: 5px 0; color: ${item.expire_days <= 7 ? '#f44336' : '#666'};"><strong>Expires in ${item.expire_days} days</strong></p>
                    </div>
                `;
                
                remindersList.appendChild(reminderItem);
            });
        } else {
            remindersList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No items found</p>';
        }
    } catch (error) {
        console.error('Error loading reminders:', error);
        remindersList.innerHTML = '<p style="text-align: center; color: #f44336; padding: 20px;">⚠️ Error loading expiry reminders</p>';
    }
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

// Load and display pending tasks with countdown timers
async function loadPendingTasks() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.operatorId) return;

    const pendingSection = document.getElementById('pending-tasks-section');
    const pendingList = document.getElementById('pending-tasks-list');
    
    try {
        const response = await fetch(`/api/pending-tasks/list?operatorId=${user.operatorId}`);
        const data = await response.json();
        
        if (data.success && data.tasks && data.tasks.length > 0) {
            // Show section
            pendingSection.style.display = 'block';
            
            // Clear existing content
            pendingList.innerHTML = '';
            
            // Display each task
            data.tasks.forEach(task => {
                const taskCard = document.createElement('div');
                taskCard.className = 'pending-task-card';
                taskCard.style.cssText = `
                    background: white;
                    border-left: 4px solid ${task.task_type === 'incoming' ? '#4CAF50' : '#2196F3'};
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 10px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                `;
                
                // Calculate minutes and seconds
                const totalSeconds = Math.max(0, Math.floor(task.seconds_remaining));
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                
                taskCard.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="background: ${task.task_type === 'incoming' ? '#4CAF50' : '#2196F3'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                            ${task.task_type === 'incoming' ? '📥 INCOMING' : '📤 OUTGOING'}
                        </span>
                        <span class="timer" data-seconds="${totalSeconds}" style="font-size: 18px; font-weight: bold; color: ${totalSeconds < 300 ? '#f44336' : '#4CAF50'};">
                            ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}
                        </span>
                    </div>
                    <div style="font-size: 14px; color: #333;">
                        <strong>SKU:</strong> ${task.sku || 'N/A'}<br>
                        <strong>Bin:</strong> ${task.bin_no || 'N/A'}<br>
                        <strong>Quantity:</strong> ${task.cfc || 0} units
                    </div>
                    <div style="margin-top: 10px; font-size: 12px; color: #666;">
                        Click to resume this task
                    </div>
                `;
                
                // Hover effect
                taskCard.addEventListener('mouseenter', () => {
                    taskCard.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                    taskCard.style.transform = 'translateY(-2px)';
                });
                taskCard.addEventListener('mouseleave', () => {
                    taskCard.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    taskCard.style.transform = 'translateY(0)';
                });
                
                // Click to resume task
                taskCard.addEventListener('click', () => resumeTask(task));
                
                pendingList.appendChild(taskCard);
            });
            
            // Update all timers every second
            updateTimers();
            
        } else {
            // Hide section if no tasks
            pendingSection.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error loading pending tasks:', error);
        pendingSection.style.display = 'none';
    }
}

// Update countdown timers
function updateTimers() {
    const timers = document.querySelectorAll('.timer');
    
    timers.forEach(timer => {
        let seconds = parseInt(timer.dataset.seconds);
        
        if (seconds > 0) {
            seconds--;
            timer.dataset.seconds = seconds;
            
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            timer.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            
            // Change color when less than 5 minutes
            if (seconds < 300) {
                timer.style.color = '#f44336';
            }
            
            // Remove task when expired
            if (seconds === 0) {
                timer.closest('.pending-task-card').style.opacity = '0.5';
                timer.textContent = 'EXPIRED';
                setTimeout(() => {
                    loadPendingTasks(); // Reload to remove expired tasks
                }, 2000);
            }
        }
    });
    
    // Continue updating every second
    setTimeout(updateTimers, 1000);
}

// Resume a pending task
function resumeTask(task) {
    // Store task data in localStorage
    localStorage.setItem('resumeTask', JSON.stringify(task));
    
    // Redirect to appropriate page
    if (task.task_type === 'incoming') {
        window.location.href = '/incoming.html';
    } else if (task.task_type === 'outgoing') {
        window.location.href = '/outgoing.html';
    }
}
