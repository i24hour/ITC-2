// Supervisor Panel JavaScript

let allSKUs = [];
let activeSKUs = [];
let allTasks = {
    ongoing: [],
    completed: [],
    cancelled: []
};
let selectedTaskId = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication and role
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.loggedIn) {
        window.location.href = 'index.html';
        return;
    }

    if (user.role !== 'supervisor') {
        alert('Access Denied: Supervisor privileges required');
        window.location.href = 'dashboard.html';
        return;
    }

    // Logout handler
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    });

    // Initialize supervisor panel
    initSupervisorPanel();
});

async function initSupervisorPanel() {
    // Load SKU management
    await loadAllSKUs();
    await loadActiveSKUList();
    
    // Load tasks
    await loadAllTasks();
    
    // Setup event listeners
    setupSKUManagement();
    setupTabNavigation();
    setupCancelModal();
    
    // Auto-refresh tasks every 5 seconds
    setInterval(() => {
        loadAllTasks();
    }, 5000);
}

// ===== SKU MANAGEMENT =====

async function loadAllSKUs() {
    try {
        const response = await fetch('/api/sku-list');
        const data = await response.json();
        allSKUs = data.skus;
        
        document.getElementById('total-sku-count').textContent = allSKUs.length;
        renderSKUGrid();
    } catch (error) {
        console.error('Error loading SKUs:', error);
    }
}

async function loadActiveSKUList() {
    try {
        const response = await fetch('/api/supervisor/active-skus');
        const data = await response.json();
        activeSKUs = data.activeSkus || allSKUs; // Default to all if none set
        
        document.getElementById('active-sku-count').textContent = activeSKUs.length;
        updateSKUGridSelection();
    } catch (error) {
        console.error('Error loading active SKUs:', error);
        activeSKUs = allSKUs; // Fallback to all SKUs
    }
}

function renderSKUGrid() {
    const grid = document.getElementById('all-skus-grid');
    grid.innerHTML = '';
    
    allSKUs.forEach(sku => {
        const skuCard = document.createElement('div');
        skuCard.className = 'sku-checkbox-card';
        skuCard.dataset.sku = sku;
        
        const isActive = activeSKUs.includes(sku);
        
        skuCard.innerHTML = `
            <label class="sku-checkbox-label">
                <input type="checkbox" value="${sku}" ${isActive ? 'checked' : ''}>
                <span class="sku-name">${sku}</span>
                <span class="sku-status">${isActive ? '✓ Active' : 'Inactive'}</span>
            </label>
        `;
        
        grid.appendChild(skuCard);
    });
}

function updateSKUGridSelection() {
    const checkboxes = document.querySelectorAll('.sku-checkbox-card input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = activeSKUs.includes(cb.value);
        const statusSpan = cb.parentElement.querySelector('.sku-status');
        statusSpan.textContent = cb.checked ? '✓ Active' : 'Inactive';
    });
    document.getElementById('active-sku-count').textContent = activeSKUs.length;
}

function setupSKUManagement() {
    // Search filter
    document.getElementById('sku-search-filter').addEventListener('input', (e) => {
        const search = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.sku-checkbox-card');
        
        cards.forEach(card => {
            const sku = card.dataset.sku.toLowerCase();
            card.style.display = sku.includes(search) ? 'block' : 'none';
        });
    });
    
    // Select all
    document.getElementById('select-all-skus').addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.sku-checkbox-card input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = true;
            const statusSpan = cb.parentElement.querySelector('.sku-status');
            statusSpan.textContent = '✓ Active';
        });
        activeSKUs = [...allSKUs];
        document.getElementById('active-sku-count').textContent = activeSKUs.length;
    });
    
    // Deselect all
    document.getElementById('deselect-all-skus').addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.sku-checkbox-card input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = false;
            const statusSpan = cb.parentElement.querySelector('.sku-status');
            statusSpan.textContent = 'Inactive';
        });
        activeSKUs = [];
        document.getElementById('active-sku-count').textContent = 0;
    });
    
    // Checkbox change
    document.getElementById('all-skus-grid').addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const sku = e.target.value;
            const statusSpan = e.target.parentElement.querySelector('.sku-status');
            
            if (e.target.checked) {
                if (!activeSKUs.includes(sku)) {
                    activeSKUs.push(sku);
                }
                statusSpan.textContent = '✓ Active';
            } else {
                activeSKUs = activeSKUs.filter(s => s !== sku);
                statusSpan.textContent = 'Inactive';
            }
            
            document.getElementById('active-sku-count').textContent = activeSKUs.length;
        }
    });
    
    // Save SKU list
    document.getElementById('save-sku-list').addEventListener('click', async () => {
        try {
            const response = await fetch('/api/supervisor/active-skus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activeSkus: activeSKUs })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert(`✅ Successfully saved! ${activeSKUs.length} SKUs are now active in operator dropdowns.`);
            }
        } catch (error) {
            console.error('Error saving SKU list:', error);
            alert('Error saving SKU list. Please try again.');
        }
    });
}

// ===== TASK MONITORING =====

async function loadAllTasks() {
    try {
        const response = await fetch('/api/supervisor/tasks');
        const data = await response.json();
        
        allTasks = data.tasks || { ongoing: [], completed: [], cancelled: [] };
        
        renderOngoingTasks();
        renderCompletedTasks();
        renderCancelledTasks();
        updateStatistics();
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

function renderOngoingTasks() {
    const tbody = document.getElementById('ongoing-tasks-body');
    const emptyState = document.getElementById('no-ongoing-tasks');
    
    if (allTasks.ongoing.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    tbody.innerHTML = '';
    
    allTasks.ongoing.forEach(task => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${task.id}</td>
            <td>${task.operator}</td>
            <td><span class="badge ${task.type}">${task.type}</span></td>
            <td>${task.sku}</td>
            <td>${task.quantity}</td>
            <td>${formatDateTime(task.startTime)}</td>
            <td><span class="status-badge incomplete">${task.status}</span></td>
            <td>
                <button class="btn btn-small btn-danger" onclick="openCancelModal('${task.id}')">
                    ❌ Cancel
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function renderCompletedTasks() {
    const tbody = document.getElementById('completed-tasks-body');
    const emptyState = document.getElementById('no-completed-tasks');
    
    if (allTasks.completed.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    tbody.innerHTML = '';
    
    allTasks.completed.forEach(task => {
        const duration = calculateDuration(task.startTime, task.endTime);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${task.id}</td>
            <td>${task.operator}</td>
            <td><span class="badge ${task.type}">${task.type}</span></td>
            <td>${task.sku}</td>
            <td>${task.quantity}</td>
            <td>${formatDateTime(task.startTime)}</td>
            <td>${formatDateTime(task.endTime)}</td>
            <td>${duration}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderCancelledTasks() {
    const tbody = document.getElementById('cancelled-tasks-body');
    const emptyState = document.getElementById('no-cancelled-tasks');
    
    if (allTasks.cancelled.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    tbody.innerHTML = '';
    
    allTasks.cancelled.forEach(task => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${task.id}</td>
            <td>${task.operator}</td>
            <td><span class="badge ${task.type}">${task.type}</span></td>
            <td>${task.sku}</td>
            <td>${task.reason}</td>
            <td>${task.cancelledBy}</td>
            <td>${formatDateTime(task.cancelledAt)}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateStatistics() {
    const activeOperators = new Set(allTasks.ongoing.map(t => t.operator)).size;
    const ongoingCount = allTasks.ongoing.length;
    
    // Count completed today
    const today = new Date().toDateString();
    const completedToday = allTasks.completed.filter(t => 
        new Date(t.endTime).toDateString() === today
    ).length;
    
    document.getElementById('stat-active-operators').textContent = activeOperators;
    document.getElementById('stat-ongoing-tasks').textContent = ongoingCount;
    document.getElementById('stat-completed-today').textContent = completedToday;
    document.getElementById('stat-active-skus').textContent = activeSKUs.length;
}

// ===== TAB NAVIGATION =====

function setupTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Remove active class from all tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab
            btn.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
}

// ===== CANCEL TASK MODAL =====

function setupCancelModal() {
    const modal = document.getElementById('cancel-modal');
    const closeBtn = modal.querySelector('.close');
    const cancelClose = document.getElementById('cancel-modal-close');
    const confirmBtn = document.getElementById('confirm-cancel-task');
    
    closeBtn.onclick = () => modal.style.display = 'none';
    cancelClose.onclick = () => modal.style.display = 'none';
    
    window.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    confirmBtn.addEventListener('click', async () => {
        const reason = document.getElementById('cancel-reason').value.trim();
        
        if (!reason) {
            alert('Please enter a reason for cancellation');
            return;
        }
        
        await cancelTask(selectedTaskId, reason);
        modal.style.display = 'none';
        document.getElementById('cancel-reason').value = '';
    });
}

function openCancelModal(taskId) {
    selectedTaskId = taskId;
    document.getElementById('cancel-modal').style.display = 'block';
}

async function cancelTask(taskId, reason) {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        
        const response = await fetch('/api/supervisor/cancel-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId,
                reason,
                cancelledBy: user.name
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Task cancelled successfully. Operator will not be able to scan QR codes for this task.');
            await loadAllTasks();
        }
    } catch (error) {
        console.error('Error cancelling task:', error);
        alert('Error cancelling task. Please try again.');
    }
}

// ===== UTILITY FUNCTIONS =====

function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function calculateDuration(start, end) {
    const diff = new Date(end) - new Date(start);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
}
