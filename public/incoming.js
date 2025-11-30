// Incoming Inventory JavaScript

let currentStep = 1;
let incomingData = {};
let selectedBins = [];
let html5QrCode;
let currentTaskId = null; // Store task ID for tracking
let taskStartTime = null; // Store when task started
let currentUOM = null; // Store UOM for weight calculation

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.loggedIn) {
        window.location.href = 'index.html';
        return;
    }

    // Logout handler
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    });

    // Check if resuming a pending task
    checkAndResumePendingTask();

    initStep1();
});

// Check and resume pending task if coming from dashboard
async function checkAndResumePendingTask() {
    const resumeTask = localStorage.getItem('resumeTask');
    if (!resumeTask) return;
    
    try {
        const task = JSON.parse(resumeTask);
        localStorage.removeItem('resumeTask'); // Clear immediately
        
        if (task.task_type === 'incoming' && task.sku) {
            // Pre-fill the form
            document.getElementById('sku-input').value = task.sku || '';
            document.getElementById('cfc-count').value = task.cfc || '';
            document.getElementById('weight-input').value = task.weight || '';
            
            // Fetch SKU details
            if (task.sku) {
                await fetchAndDisplaySKUDetails(task.sku);
            }
            
            // Show notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                z-index: 10000;
                font-weight: bold;
            `;
            notification.textContent = '✅ Task resumed! Please complete within time limit.';
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 5000);
        }
    } catch (error) {
        console.error('Error resuming task:', error);
        localStorage.removeItem('resumeTask');
    }
}

// ===== STEP 1: Enter SKU Details =====
function initStep1() {
    const form = document.getElementById('incoming-form');
    const skuInput = document.getElementById('sku-input');
    
    // Load SKU list for autocomplete
    loadSKUList(skuInput);
    
    // Add event listener for SKU selection to fetch description
    skuInput.addEventListener('change', async (e) => {
        const sku = e.target.value.trim();
        if (sku) {
            await fetchAndDisplaySKUDetails(sku);
            // Auto-calculate weight if CFC is already entered
            calculateWeight();
        } else {
            // Hide description if no SKU selected
            document.getElementById('sku-description-container').style.display = 'none';
        }
    });
    
    // Add event listener for CFC count to auto-calculate weight
    const cfcInput = document.getElementById('cfc-count');
    cfcInput.addEventListener('input', () => {
        calculateWeight();
    });
    
    // Cancel task button handler
    const cancelBtn = document.getElementById('cancel-task-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
            const sku = document.getElementById('sku-input').value.trim();
            const cfc = parseInt(document.getElementById('cfc-count').value) || 0;
            const weight = parseFloat(document.getElementById('weight-input').value) || 0;
            
            if (!sku && !cfc) {
                // Nothing to cancel
                window.location.href = 'dashboard.html';
                return;
            }
            
            if (confirm('Are you sure you want to cancel this task?')) {
                await cancelTask(sku, cfc, weight, 'User cancelled in Step 1');
                window.location.href = 'dashboard.html';
            }
        });
    }
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const sku = document.getElementById('sku-input').value.trim();
        const quantity = parseInt(document.getElementById('cfc-count').value);
        const weight = parseFloat(document.getElementById('weight-input').value);

        if (!sku) {
            alert('Please select a SKU');
            return;
        }

        incomingData = { sku, quantity, weight };
        
        goToStep2();
    });
}

// Cancel task and save to Task_History
async function cancelTask(sku, cfc, weight, reason = 'User cancelled') {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.operatorId) return;
    
    try {
        const response = await fetch('/api/tasks/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operatorId: user.operatorId,
                taskType: 'incoming',
                sku: sku || '',
                binNo: null,
                cfc: cfc || 0,
                weight: weight || 0,
                batchNo: null,
                reason: reason
            })
        });
        
        const result = await response.json();
        if (result.success) {
            console.log('✅ Task cancelled and saved to history');
        } else {
            console.error('Failed to save cancelled task:', result.message);
        }
    } catch (error) {
        console.error('Error cancelling task:', error);
    }
}

// Fetch and display SKU details (description and UOM)
async function fetchAndDisplaySKUDetails(sku) {
    try {
        const response = await fetch(`/api/sku-details/${sku}`);
        const data = await response.json();
        
        if (data.description) {
            currentUOM = parseFloat(data.uom); // Store UOM for calculation
            document.getElementById('sku-description').textContent = data.description;
            document.getElementById('sku-uom').textContent = `UOM: ${data.uom} kg per CFC`;
            document.getElementById('sku-description-container').style.display = 'block';
        }
    } catch (error) {
        console.error('Error fetching SKU details:', error);
        document.getElementById('sku-description-container').style.display = 'none';
        currentUOM = null;
    }
}

// Auto-calculate weight based on CFC × UOM
function calculateWeight() {
    const cfcInput = document.getElementById('cfc-count');
    const weightInput = document.getElementById('weight-input');
    
    const cfc = parseInt(cfcInput.value);
    
    console.log('calculateWeight called - CFC:', cfc, 'UOM:', currentUOM);
    
    // Only calculate if we have both CFC and UOM
    if (cfc && currentUOM) {
        const calculatedWeight = (cfc * currentUOM).toFixed(3); // 3 decimal places
        weightInput.value = calculatedWeight;
        weightInput.style.backgroundColor = '#e8f5e9'; // Light green to show auto-filled
        console.log('✅ Weight calculated:', calculatedWeight);
    } else {
        weightInput.value = '';
        weightInput.style.backgroundColor = '';
        console.log('⚠️ Missing data - CFC:', cfc, 'UOM:', currentUOM);
    }
}

// Load available SKUs from server
async function loadSKUList(inputElement) {
    console.log('🔄 Loading SKU list...');
    try {
        const response = await fetch('/api/sku-list');
        console.log('📡 API Response status:', response.status);
        
        const data = await response.json();
        console.log('📦 SKU data received:', data);
        console.log('📊 Total SKUs:', data.skus ? data.skus.length : 0);
        
        // Clear existing options except the first one
        inputElement.innerHTML = '<option value="">Select a SKU...</option>';
        
        // Add option elements for each SKU
        data.skus.forEach(sku => {
            const option = document.createElement('option');
            option.value = sku;
            option.textContent = sku;
            inputElement.appendChild(option);
        });
        
        console.log('✅ SKU list loaded successfully');
    } catch (error) {
        console.error('❌ Error loading SKU list:', error);
    }
}

// ===== STEP 2: Select Bins =====
async function goToStep2() {
    // Set task start time when entering step 2
    taskStartTime = new Date().toISOString();
    
    document.getElementById('step1').classList.remove('active');
    document.getElementById('step2').classList.add('active');
    
    // Display SKU info
    document.getElementById('display-sku').textContent = incomingData.sku;
    document.getElementById('display-qty').textContent = incomingData.quantity;
    
    // Update counters
    updateBinCounters();
    
    // Load bins from server
    await loadAvailableBins();
    
    // Initialize step 2 buttons
    initStep2();
}

async function loadAvailableBins() {
    try {
        const response = await fetch(`/api/bins/available?sku=${incomingData.sku}`);
        const data = await response.json();
        
        // Show partially filled and full bins together (all bins with cfc > 0)
        const sameSKUBins = [...(data.partialBins || []), ...(data.fullBins || [])];
        
        renderBins(sameSKUBins, 'partial-bins-grid');
        
        // Show empty bins with same SKU (cfc = 0) - like F37
        // Only bins that had this SKU before but are now empty
        renderBins(data.emptyBins || [], 'empty-bins-grid');
    } catch (error) {
        console.error('Error loading bins:', error);
        // Fallback to empty if API fails
        renderBins([], 'partial-bins-grid');
        renderBins([], 'empty-bins-grid');
    }
}

// Track selected bins with quantities for incoming
let selectedBinsWithQty = new Map(); // Map of binId -> { bin, quantity }
let totalSelectedQty = 0;

function renderBins(bins, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    bins.forEach((bin, index) => {
        const binAvailable = bin.available || 50;
        const binSelected = selectedBinsWithQty.get(bin.id)?.quantity || 0;
        const remainingQty = incomingData.quantity - totalSelectedQty;
        
        // Allow clicking if: (1) bin not selected yet and space available, OR (2) bin already selected (to deselect)
        const isClickable = (remainingQty > 0 && binSelected === 0) || binSelected > 0;
        
        const binCard = document.createElement('div');
        binCard.className = 'bin-card';
        binCard.dataset.binId = bin.id;
        binCard.style.cssText = `padding: 15px; border: 2px solid #ddd; border-radius: 8px; margin-bottom: 10px; transition: all 0.3s; cursor: pointer;`;
        
        if (binSelected > 0) {
            binCard.style.borderColor = '#4CAF50';
            binCard.style.backgroundColor = '#e8f5e9';
        } else if (!isClickable) {
            binCard.style.opacity = '0.6';
            binCard.style.cursor = 'not-allowed';
        }
        
        binCard.innerHTML = `
            <div class="bin-name" style="font-weight: bold; font-size: 18px;">${bin.id}</div>
            <div class="bin-details" style="color: #666; font-size: 14px;">
                Current: ${bin.current}/${bin.capacity}
            </div>
            <div class="bin-capacity" style="font-weight: bold; font-size: 20px; margin-top: 5px;">
                <span style="color: ${binSelected > 0 ? '#4CAF50' : '#999'};">${binSelected}</span> / 
                <span style="color: #666;">${binAvailable}</span>
            </div>
            <div style="font-size: 12px; color: #666;">Selected / Available</div>
        `;
        
        binCard.addEventListener('click', () => {
            if (binSelected > 0) {
                // Deselect
                updateBinQuantityIncoming(bin, 0);
            } else if (remainingQty > 0) {
                // Auto-select max possible quantity
                const autoSelectQty = Math.min(binAvailable, remainingQty);
                updateBinQuantityIncoming(bin, autoSelectQty);
            }
        });
        
        // Hover effect
        binCard.addEventListener('mouseenter', () => {
            if (binSelected > 0) {
                binCard.style.borderColor = '#f44336';
                binCard.style.backgroundColor = '#ffebee';
            } else if (remainingQty > 0) {
                binCard.style.borderColor = '#2196F3';
                binCard.style.backgroundColor = '#E3F2FD';
            }
        });
        
        binCard.addEventListener('mouseleave', () => {
            if (binSelected > 0) {
                binCard.style.borderColor = '#4CAF50';
                binCard.style.backgroundColor = '#e8f5e9';
            } else {
                binCard.style.borderColor = '#ddd';
                binCard.style.backgroundColor = 'white';
            }
        });
        
        container.appendChild(binCard);
    });
}

function updateBinQuantityIncoming(bin, newQuantity) {
    const binAvailable = bin.available || 50;
    const currentSelected = selectedBinsWithQty.get(bin.id)?.quantity || 0;
    
    // Ensure quantity is within bounds
    if (newQuantity < 0) newQuantity = 0;
    if (newQuantity > binAvailable) newQuantity = binAvailable;
    
    // Calculate remaining capacity
    const remainingQty = incomingData.quantity - (totalSelectedQty - currentSelected);
    if (newQuantity > remainingQty) {
        newQuantity = remainingQty;
    }
    
    // Update total
    totalSelectedQty = totalSelectedQty - currentSelected + newQuantity;
    
    // Update map
    if (newQuantity > 0) {
        selectedBinsWithQty.set(bin.id, { bin, quantity: newQuantity });
    } else {
        selectedBinsWithQty.delete(bin.id);
    }
    
    // Update selectedBins array for compatibility
    selectedBins = Array.from(selectedBinsWithQty.values()).map(item => item.bin);
    
    // Re-render to update display
    loadAvailableBins();
    
    // Update counters
    updateBinCounters();
    updateProceedButton();
}

function updateBinCounters() {
    const totalRequired = incomingData.quantity;
    const totalSelected = totalSelectedQty;
    const remaining = Math.max(0, totalRequired - totalSelected);
    
    document.getElementById('total-required').textContent = totalRequired;
    document.getElementById('total-selected').textContent = totalSelected;
    document.getElementById('total-remaining').textContent = remaining;
}

function updateProceedButton() {
    const proceedBtn = document.getElementById('proceed-to-scan');
    const requiredQty = parseInt(incomingData.quantity);
    const selectedQty = totalSelectedQty;
    
    if (selectedQty === requiredQty && selectedQty > 0) {
        proceedBtn.disabled = false;
        proceedBtn.style.opacity = '1';
        proceedBtn.style.cursor = 'pointer';
        proceedBtn.style.backgroundColor = '#4CAF50';
    } else {
        proceedBtn.disabled = true;
        proceedBtn.style.opacity = '0.5';
        proceedBtn.style.cursor = 'not-allowed';
        proceedBtn.style.backgroundColor = '#ccc';
    }
}

function initStep2() {
    document.getElementById('back-to-form').addEventListener('click', async () => {
        // Save as pending task before going back
        await savePendingTask();
        
        document.getElementById('step2').classList.remove('active');
        document.getElementById('step1').classList.add('active');
        selectedBins = [];
    });
    
    document.getElementById('proceed-to-scan').addEventListener('click', () => {
        goToStep3();
    });
}

// Save current state as pending task
async function savePendingTask() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.operatorId) return;
    
    // Get current form data
    const sku = incomingData.sku || document.getElementById('sku-input').value.trim();
    const cfc = incomingData.quantity || parseInt(document.getElementById('cfc-count').value) || 0;
    const weight = incomingData.weight || parseFloat(document.getElementById('weight-input').value) || 0;
    
    // Only save if there's meaningful data
    if (!sku || cfc === 0) return;
    
    try {
        const response = await fetch('/api/pending-tasks/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operatorId: user.operatorId,
                taskType: 'incoming',
                sku: sku,
                binNo: null, // Not selected yet
                cfc: cfc,
                weight: weight
            })
        });
        
        const result = await response.json();
        if (result.success) {
            console.log('✅ Pending task saved:', result.task);
        }
    } catch (error) {
        console.error('Error saving pending task:', error);
    }
}

// ===== STEP 3: QR Scanner =====
async function goToStep3() {
    // Create bin holds before proceeding
    const holdsCreated = await createBinHolds();
    if (!holdsCreated) {
        alert('Failed to reserve bin space. Please try again.');
        return;
    }
    
    // Create pending task with 30-minute expiry
    await createPendingTaskWithTimer();
    
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step3').classList.add('active');
    
    // Start 30-minute timer
    startTaskTimer();
    
    // Create task for supervisor monitoring
    await createTask();
    
    // Populate incomplete bins list
    populateScanLists();
    
    // Initialize QR scanner
    await initQRScanner();
    
    // Initialize step 3 buttons
    initStep3();
}

// Create bin holds for selected bins
async function createBinHolds() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.operatorId) return false;
    
    try {
        // Build bins array from selectedBinsWithQty Map
        const bins = Array.from(selectedBinsWithQty.entries()).map(([binNo, data]) => ({
            binNo: binNo,
            cfcToHold: data.quantity
        }));
        
        const response = await fetch('/api/bins/hold', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bins: bins,
                operatorId: user.operatorId,
                sku: incomingData.sku,
                taskId: null // Will be set when pending task is created
            })
        });
        
        const result = await response.json();
        if (result.success) {
            console.log('✅ Bin holds created:', result.holds);
            currentTaskId = result.taskId; // Store for later use
            return true;
        } else {
            console.error('Failed to create holds:', result.message);
            alert(result.message || 'Failed to reserve bin space');
            return false;
        }
    } catch (error) {
        console.error('Error creating bin holds:', error);
        return false;
    }
}

// Create pending task with 30-minute timer
async function createPendingTaskWithTimer() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.operatorId) return;
    
    try {
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
        
        const response = await fetch('/api/pending-tasks/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operatorId: user.operatorId,
                taskType: 'incoming',
                sku: incomingData.sku,
                binNo: Array.from(selectedBinsWithQty.keys()).join(','),
                cfc: incomingData.quantity,
                weight: incomingData.weight,
                expiresAt: expiresAt.toISOString(),
                binsHeld: Array.from(selectedBinsWithQty.entries()).map(([binNo, data]) => ({
                    binNo: binNo,
                    cfc: data.quantity
                }))
            })
        });
        
        const result = await response.json();
        if (result.success) {
            currentTaskId = result.task.id;
            console.log('✅ Pending task created with ID:', currentTaskId);
        }
    } catch (error) {
        console.error('Error creating pending task:', error);
    }
}

// Timer variables
let timerInterval = null;
let timerEndTime = null;

// Start 30-minute countdown timer
function startTaskTimer() {
    timerEndTime = Date.now() + 30 * 60 * 1000; // 30 minutes
    
    // Update timer display every second
    timerInterval = setInterval(() => {
        const remaining = timerEndTime - Date.now();
        
        if (remaining <= 0) {
            // Timer expired
            clearInterval(timerInterval);
            handleTimerExpiry();
        } else {
            // Update display
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            const timerDisplay = document.getElementById('time-remaining');
            if (timerDisplay) {
                timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                // Change color when less than 5 minutes
                if (remaining < 5 * 60 * 1000) {
                    timerDisplay.style.color = '#d9534f'; // Red
                } else {
                    timerDisplay.style.color = '#5cb85c'; // Green
                }
            }
        }
    }, 1000);
}

// Handle timer expiry
async function handleTimerExpiry() {
    alert('Task time expired! Holds will be released and task marked as incomplete.');
    
    // Release holds
    if (currentTaskId) {
        await fetch('/api/bins/release-hold', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: currentTaskId })
        });
    }
    
    // Redirect to dashboard
    window.location.href = 'dashboard.html';
}

// Create task for supervisor monitoring
async function createTask() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        // Format: binId:quantity pairs (e.g., "G13:37,L28:45,F37:10")
        // Use the actual selected quantities from the Map
        const binDetails = Array.from(selectedBinsWithQty.entries())
            .map(([binId, data]) => `${binId}:${data.quantity}`)
            .join(',');
        
        console.log('Creating incoming task with bins:', binDetails);
        
        const response = await fetch('/api/tasks/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operator: user.name || user.email,
                sku: incomingData.sku,
                binNo: binDetails,
                quantity: incomingData.quantity,
                type: 'incoming',
                sessionToken: user.sessionToken || null
            })
        });
        
        const result = await response.json();
        if (result.success) {
            currentTaskId = result.task.id;
            console.log('Incoming task created:', currentTaskId, 'Type:', result.task.type);
            
            // Start 30-minute countdown timer
            startTaskTimer(result.task.created_at || new Date().toISOString());
        } else {
            console.error('Failed to create task:', result);
        }
    } catch (error) {
        console.error('Error creating task:', error);
    }
}

// Timer variables
let timerInterval = null;
const TASK_TIMEOUT_MINUTES = 1; // 1 minute for testing

function startTaskTimer(createdAt) {
    const timerDisplay = document.getElementById('time-remaining');
    if (!timerDisplay) return;
    
    const startTime = new Date(createdAt).getTime();
    const endTime = startTime + (TASK_TIMEOUT_MINUTES * 60 * 1000);
    
    // Clear any existing timer
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // Start periodic status check
    startTaskStatusCheck();
    
    timerInterval = setInterval(() => {
        const now = Date.now();
        const remaining = endTime - now;
        
        if (remaining <= 0) {
            clearInterval(timerInterval);
            autoCancelTask();
            return;
        }
        
        // Calculate minutes and seconds
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        
        // Update display
        timerDisplay.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
        
        // Change color based on time remaining
        if (remaining < 5 * 60 * 1000) { // Less than 5 minutes
            timerDisplay.style.color = '#d9534f'; // Red
            document.getElementById('timer-warning').style.background = '#f8d7da';
            document.getElementById('timer-warning').style.borderColor = '#d9534f';
        } else if (remaining < 10 * 60 * 1000) { // Less than 10 minutes
            timerDisplay.style.color = '#f0ad4e'; // Orange
        }
    }, 1000);
}

// Periodic check if task is still valid (every 10 seconds)
let statusCheckInterval = null;

function startTaskStatusCheck() {
    if (!currentTaskId) return;
    
    statusCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/tasks/check/${currentTaskId}`);
            const data = await response.json();
            
            if (data.isCancelled || data.task?.status === 'cancelled') {
                clearInterval(statusCheckInterval);
                clearInterval(timerInterval);
                alert('⏰ Your task has been cancelled due to timeout. The selected bins are now available for other operators.');
                window.location.href = 'dashboard.html';
            }
        } catch (error) {
            console.error('Error checking task status:', error);
        }
    }, 10000); // Check every 10 seconds
}

async function autoCancelTask() {
    if (!currentTaskId) return;
    
    try {
        alert('⏰ Time expired! This task has been automatically cancelled. The selected bins are now available for other operators.');
        
        const response = await fetch('/api/tasks/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId: currentTaskId,
                reason: 'Auto-cancelled: 30-minute timeout exceeded'
            })
        });
        
        if (response.ok) {
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
        console.error('Error auto-cancelling task:', error);
        window.location.href = 'dashboard.html';
    }
}

function populateScanLists() {
    const incompleteContainer = document.getElementById('incomplete-bins');
    incompleteContainer.innerHTML = '';
    
    // Use the selectedBinsWithQty Map to show correct quantities
    selectedBinsWithQty.forEach((data, binId) => {
        const item = document.createElement('div');
        item.className = 'bin-scan-item pending';
        item.dataset.binId = binId;
        item.textContent = `${binId} (${data.quantity} units to add)`;
        incompleteContainer.appendChild(item);
    });
}

async function initQRScanner() {
    const statusElement = document.getElementById('scan-status');
    
    try {
        statusElement.textContent = '📷 Initializing camera...';
        statusElement.style.color = '#666';
        
        // Check if mediaDevices is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera API not supported in this browser');
        }
        
        // Request camera permission explicitly first
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" } 
            });
            // Stop the test stream immediately
            stream.getTracks().forEach(track => track.stop());
            console.log('✅ Camera permission granted');
        } catch (permErr) {
            console.error('Camera permission error:', permErr);
            throw new Error('Camera permission denied. Please allow camera access in your browser settings.');
        }
        
        // Initialize Html5Qrcode
        html5QrCode = new Html5Qrcode("qr-reader");
        
        // Get available cameras
        statusElement.textContent = '📷 Loading cameras...';
        const cameras = await Html5Qrcode.getCameras();
        
        if (!cameras || cameras.length === 0) {
            throw new Error('No cameras found on this device');
        }
        
        console.log(`Found ${cameras.length} camera(s):`, cameras);
        
        // Prefer back camera (environment) for scanning
        let selectedCamera = cameras[0].id;
        for (let camera of cameras) {
            if (camera.label && camera.label.toLowerCase().includes('back')) {
                selectedCamera = camera.id;
                break;
            }
        }
        
        // Start the scanner
        statusElement.textContent = '📷 Starting scanner...';
        await html5QrCode.start(
            selectedCamera,
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            onScanSuccess,
            onScanError
        );
        
        statusElement.textContent = '✅ Ready to scan - Point camera at QR code';
        statusElement.style.color = '#4CAF50';
        
    } catch (err) {
        console.error('Error starting QR scanner:', err);
        statusElement.style.color = 'red';
        
        if (err.message.includes('permission')) {
            statusElement.textContent = '❌ Camera permission denied. Please allow camera access and refresh the page.';
        } else if (err.message.includes('not supported')) {
            statusElement.textContent = '❌ Camera not supported in this browser. Please use Chrome or Safari.';
        } else if (err.message.includes('No cameras found')) {
            statusElement.textContent = '❌ No camera found on this device.';
        } else {
            statusElement.textContent = `❌ Error: ${err.message || 'Failed to start camera'}`;
        }
    }
    
    // Toggle camera button
    const toggleBtn = document.getElementById('toggle-camera');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', async () => {
            try {
                const cameras = await Html5Qrcode.getCameras();
                if (cameras && cameras.length > 1) {
                    // Stop current camera
                    if (html5QrCode) {
                        await html5QrCode.stop();
                    }
                    
                    // Start with next camera (simple toggle for now)
                    const currentCameraIndex = cameras.findIndex(c => c.id === selectedCamera);
                    const nextCameraIndex = (currentCameraIndex + 1) % cameras.length;
                    selectedCamera = cameras[nextCameraIndex].id;
                    
                    await html5QrCode.start(
                        selectedCamera,
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 },
                            aspectRatio: 1.0
                        },
                        onScanSuccess,
                        onScanError
                    );
                    
                    statusElement.textContent = `✅ Switched to ${cameras[nextCameraIndex].label || 'camera ' + (nextCameraIndex + 1)}`;
                    statusElement.style.color = '#4CAF50';
                } else {
                    statusElement.textContent = '⚠️ Only one camera available';
                }
            } catch (err) {
                console.error('Error switching camera:', err);
                statusElement.textContent = '❌ Failed to switch camera';
                statusElement.style.color = 'red';
            }
        });
    }
}

async function onScanSuccess(decodedText, decodedResult) {
    // Check if task has been cancelled
    if (currentTaskId) {
        const isCancelled = await checkTaskCancelled();
        if (isCancelled) {
            document.getElementById('scan-status').textContent = '❌ Task cancelled by supervisor!';
            document.getElementById('scan-status').style.color = 'red';
            if (html5QrCode) {
                html5QrCode.stop();
            }
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
            return;
        }
    }
    
    // Normalize scanned text (remove hyphens, convert to uppercase)
    const normalizedScanned = decodedText.replace(/-/g, '').toUpperCase().trim();
    
    // Find matching bin by normalizing stored bin IDs
    let matchedBinId = null;
    const allBinItems = document.querySelectorAll('.bin-scan-item');
    
    for (const item of allBinItems) {
        const storedBinId = item.dataset.binId;
        const normalizedStored = storedBinId.replace(/-/g, '').toUpperCase().trim();
        
        if (normalizedStored === normalizedScanned) {
            matchedBinId = storedBinId;
            break;
        }
    }
    
    // Check if the scanned bin is in the selected list
    const binItem = matchedBinId ? document.querySelector(`.bin-scan-item[data-bin-id="${matchedBinId}"]`) : null;
    
    if (binItem && binItem.classList.contains('pending')) {
        // Move to complete list
        binItem.classList.remove('pending');
        binItem.classList.add('scanned');
        
        document.getElementById('complete-bins').appendChild(binItem);
        
        // Update status
        document.getElementById('scan-status').textContent = `✅ ${matchedBinId} scanned successfully!`;
        document.getElementById('scan-status').style.color = '#4CAF50';
        
        // Update bin in database (use the matched bin ID from database)
        updateBinInDatabase(matchedBinId);
        
        // Check if all bins are scanned
        checkAllBinsScanned();
    } else if (binItem && binItem.classList.contains('scanned')) {
        document.getElementById('scan-status').textContent = `⚠️ ${matchedBinId} already scanned`;
        document.getElementById('scan-status').style.color = '#FF9800';
    } else {
        document.getElementById('scan-status').textContent = `❌ ${decodedText} not in selected bins`;
        document.getElementById('scan-status').style.color = 'red';
    }
}

// Check if task has been cancelled by supervisor
async function checkTaskCancelled() {
    try {
        const response = await fetch(`/api/tasks/check/${currentTaskId}`);
        const result = await response.json();
        return result.isCancelled;
    } catch (error) {
        console.error('Error checking task status:', error);
        return false;
    }
}

function onScanError(errorMessage) {
    // Ignore continuous scanning errors
}

async function updateBinInDatabase(binId) {
    try {
        const bin = selectedBins.find(b => b.id === binId);
        const user = JSON.parse(localStorage.getItem('user')) || {};

        // Use secure scan API which validates sessionToken and task
        const response = await fetch('/api/bins/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                binId,
                taskId: currentTaskId,
                sessionToken: user.sessionToken || null
            })
        });

        const result = await response.json();
        if (result.success) {
            console.log('Bin updated via secure scan:', result);
        } else {
            console.warn('Bin update failed:', result);
            document.getElementById('scan-status').textContent = `❌ Error: ${result.error || 'Update failed'}`;
            document.getElementById('scan-status').style.color = 'red';
        }
    } catch (error) {
        console.error('Error updating bin:', error);
        document.getElementById('scan-status').textContent = `❌ Network error. Please try again.`;
        document.getElementById('scan-status').style.color = 'red';
    }
}

function checkAllBinsScanned() {
    const pendingBins = document.querySelectorAll('.bin-scan-item.pending');
    
    if (pendingBins.length === 0) {
        // All bins scanned - complete the task
        completeTask();
        
        document.getElementById('complete-incoming').style.display = 'inline-flex';
        document.getElementById('scan-status').textContent = '✅ All bins filled successfully!';
        
        // Stop scanner
        if (html5QrCode) {
            html5QrCode.stop();
        }
    }
}

// Complete task in database and log to task history
async function completeTask() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const sessionToken = localStorage.getItem('sessionToken');
        
        if (!sessionToken) {
            console.error('No session token found');
            return;
        }
        
        // Prepare bins used list
        const binsUsed = selectedBins.map(bin => bin.id).join(', ');
        
        // Log task completion to Task_History
        const response = await fetch('/api/tasks/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionToken: sessionToken,
                taskType: 'incoming',
                sku: incomingData.sku,
                quantity: incomingData.quantity,
                binsUsed: binsUsed,
                startedAt: taskStartTime
            })
        });
        
        const result = await response.json();
        if (result.success) {
            console.log('Task logged successfully:', result.taskHistory);
        } else {
            console.error('Error logging task:', result.error);
        }
    } catch (error) {
        console.error('Error completing task:', error);
    }
}

function initStep3() {
    document.getElementById('cancel-scan').addEventListener('click', async () => {
        // Save as pending task before canceling
        await savePendingTaskFromScan();
        
        if (html5QrCode) {
            html5QrCode.stop();
        }
        window.location.href = 'dashboard.html';
    });
    
    document.getElementById('complete-incoming').addEventListener('click', async () => {
        // Stop timer
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        
        // Release bin holds
        if (currentTaskId) {
            await fetch('/api/bins/release-hold', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: currentTaskId })
            });
        }
        
        // Delete pending task if exists
        await deletePendingTask();
        
        // Save to history
        window.location.href = 'dashboard.html';
    });
}

// Save pending task from scan step
async function savePendingTaskFromScan() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.operatorId) return;
    
    try {
        const response = await fetch('/api/pending-tasks/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operatorId: user.operatorId,
                taskType: 'incoming',
                sku: incomingData.sku,
                binNo: selectedBins.map(b => b.id).join(', '),
                cfc: incomingData.quantity,
                weight: incomingData.weight
            })
        });
        
        const result = await response.json();
        if (result.success) {
            console.log('✅ Pending task saved from scan step:', result.task);
        }
    } catch (error) {
        console.error('Error saving pending task:', error);
    }
}

// Delete pending task after completion
async function deletePendingTask() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.operatorId) return;
    
    try {
        // Find and cancel pending tasks for this operator and SKU
        const listResponse = await fetch(`/api/pending-tasks/list?operatorId=${user.operatorId}`);
        const listData = await listResponse.json();
        
        if (listData.success && listData.tasks) {
            const matchingTask = listData.tasks.find(t => 
                t.task_type === 'incoming' && 
                t.sku === incomingData.sku
            );
            
            if (matchingTask) {
                await fetch('/api/pending-tasks/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        taskId: matchingTask.id
                    })
                });
                console.log('✅ Pending task deleted after completion');
            }
        }
    } catch (error) {
        console.error('Error deleting pending task:', error);
    }
}
