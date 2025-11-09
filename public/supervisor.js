// Supervisor Panel JavaScript

let allSKUs = [];
let activeSKUs = [];

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
    
    // Setup event listeners
    setupSKUManagement();
    setupOperatorCreation();
    setupAddSKUForm();
}

function setupOperatorCreation() {
    const form = document.getElementById('create-operator-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('operator-name').value.trim();
        const email = document.getElementById('operator-email').value.trim();
        const password = document.getElementById('operator-password').value;
        const confirmPassword = document.getElementById('operator-confirm-password').value;
        
        // Validation
        if (!name || !email || !password) {
            alert('❌ Please fill in all fields');
            return;
        }
        
        if (password !== confirmPassword) {
            alert('❌ Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            alert('❌ Password must be at least 6 characters');
            return;
        }
        
        try {
            const response = await fetch('/api/supervisor/create-operator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                alert(`✅ Operator account created successfully!\n\nOperator ID: ${result.operatorId}\nEmail: ${email}\n\nThe operator can now login with these credentials.`);
                form.reset();
            } else {
                alert('❌ Error: ' + (result.error || 'Failed to create operator account'));
            }
        } catch (error) {
            console.error('Error creating operator:', error);
            alert('❌ Error creating operator account. Please try again.');
        }
    });
}

// ===== SKU MANAGEMENT =====

async function loadAllSKUs() {
    try {
        // Use supervisor endpoint to get ALL SKUs (not filtered by active status)
        const response = await fetch('/api/supervisor/active-skus');
        const data = await response.json();
        allSKUs = data.allSKUs || [];
        
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
                body: JSON.stringify({ activeSKUs: activeSKUs })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert(`✅ Successfully saved! ${activeSKUs.length} SKUs are now active in operator dropdowns.`);
            } else {
                alert('❌ Error: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error saving SKU list:', error);
            alert('Error saving SKU list. Please try again.');
        }
    });
}

function setupAddSKUForm() {
    const form = document.getElementById('add-sku-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const sku = document.getElementById('new-sku-code').value.trim().toUpperCase();
        const description = document.getElementById('new-sku-description').value.trim();
        const uom = document.getElementById('new-sku-uom').value.trim();
        const expireInDays = document.getElementById('new-sku-expire').value.trim();
        
        // Validation
        if (!sku || !description || !uom) {
            alert('⚠️ Please fill in all required fields (SKU, Description, UOM)');
            return;
        }
        
        if (parseFloat(uom) <= 0) {
            alert('⚠️ UOM must be greater than 0');
            return;
        }
        
        if (expireInDays && parseInt(expireInDays) < 0) {
            alert('⚠️ Expire in days cannot be negative');
            return;
        }
        
        try {
            const response = await fetch('/api/supervisor/add-sku', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sku,
                    description,
                    uom: parseFloat(uom),
                    expireInDays: expireInDays ? parseInt(expireInDays) : null
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert(`✅ SKU Added Successfully!\n\nSKU: ${result.sku.sku}\nDescription: ${result.sku.description}\nUOM: ${result.sku.uom} kg\nExpire In: ${result.sku.expire_in_days || 'N/A'} days`);
                
                // Reset form
                form.reset();
                
                // Reload SKU list
                await loadAllSKUs();
            } else {
                alert('❌ Error: ' + (result.error || 'Failed to add SKU'));
            }
        } catch (error) {
            console.error('Error adding SKU:', error);
            alert('❌ Network error. Please check your connection and try again.');
        }
    });
}
