// Incoming Inventory JavaScript

let currentStep = 1;
let incomingData = {};
let selectedBins = [];
let html5QrCode;
let currentTaskId = null; // Store task ID for tracking

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

    initStep1();
});

// ===== STEP 1: Enter SKU Details =====
function initStep1() {
    const form = document.getElementById('incoming-form');
    const skuInput = document.getElementById('sku-input');
    
    // Load SKU list for autocomplete
    loadSKUList(skuInput);
    
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

// Load available SKUs from server
async function loadSKUList(inputElement) {
    try {
        const response = await fetch('/api/sku-list');
        const data = await response.json();
        
        // Clear existing options except the first one
        inputElement.innerHTML = '<option value="">Select a SKU...</option>';
        
        // Add option elements for each SKU
        data.skus.forEach(sku => {
            const option = document.createElement('option');
            option.value = sku;
            option.textContent = sku;
            inputElement.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading SKU list:', error);
    }
}

// ===== STEP 2: Select Bins =====
async function goToStep2() {
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
        
        renderBins(data.partialBins, 'partial-bins-grid');
        renderBins(data.emptyBins, 'empty-bins-grid');
    } catch (error) {
        console.error('Error loading bins:', error);
        // Fallback to mock data if API fails
        const partialBins = [];
        const emptyBins = [
            { id: 'BIN-011', sku: null, current: 0, capacity: 50, available: 50 },
            { id: 'BIN-012', sku: null, current: 0, capacity: 50, available: 50 },
            { id: 'BIN-013', sku: null, current: 0, capacity: 50, available: 50 },
        ];
        renderBins(partialBins, 'partial-bins-grid');
        renderBins(emptyBins, 'empty-bins-grid');
    }
}

function renderBins(bins, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    bins.forEach(bin => {
        const binCard = document.createElement('div');
        binCard.className = 'bin-card';
        binCard.dataset.binId = bin.id;
        binCard.dataset.available = bin.available;
        
        binCard.innerHTML = `
            <div class="bin-name">${bin.id}</div>
            <div class="bin-details">
                Current: ${bin.current}/${bin.capacity}
            </div>
            <div class="bin-capacity">Available: ${bin.available}</div>
        `;
        
        binCard.addEventListener('click', () => toggleBinSelection(binCard, bin));
        
        container.appendChild(binCard);
    });
}

function toggleBinSelection(binCard, bin) {
    const isSelected = binCard.classList.contains('selected');
    
    if (isSelected) {
        binCard.classList.remove('selected');
        selectedBins = selectedBins.filter(b => b.id !== bin.id);
    } else {
        binCard.classList.add('selected');
        selectedBins.push(bin);
    }
    
    updateBinCounters();
    updateProceedButton();
}

function updateBinCounters() {
    const totalRequired = incomingData.quantity;
    const totalSelected = selectedBins.reduce((sum, bin) => sum + bin.available, 0);
    const remaining = Math.max(0, totalRequired - totalSelected);
    
    document.getElementById('total-required').textContent = totalRequired;
    document.getElementById('total-selected').textContent = totalSelected;
    document.getElementById('total-remaining').textContent = remaining;
}

function updateProceedButton() {
    const proceedBtn = document.getElementById('proceed-to-scan');
    const totalSelected = selectedBins.reduce((sum, bin) => sum + bin.available, 0);
    
    proceedBtn.disabled = totalSelected < incomingData.quantity;
}

function initStep2() {
    document.getElementById('back-to-form').addEventListener('click', () => {
        document.getElementById('step2').classList.remove('active');
        document.getElementById('step1').classList.add('active');
        selectedBins = [];
    });
    
    document.getElementById('proceed-to-scan').addEventListener('click', () => {
        goToStep3();
    });
}

// ===== STEP 3: QR Scanner =====
async function goToStep3() {
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step3').classList.add('active');
    
    // Create task for supervisor monitoring
    await createTask();
    
    // Populate incomplete bins list
    populateScanLists();
    
    // Initialize QR scanner
    await initQRScanner();
    
    // Initialize step 3 buttons
    initStep3();
}

// Create task for supervisor monitoring
async function createTask() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        // Format: binId:quantity pairs (e.g., "F37:10,G13:5")
        // For incoming, distribute quantity equally or use specified amounts per bin
        const qtyPerBin = Math.ceil(incomingData.quantity / selectedBins.length);
        const binDetails = selectedBins.map(b => `${b.id}:${qtyPerBin}`).join(',');
        
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
            console.log('Incoming task created:', currentTaskId);
        }
    } catch (error) {
        console.error('Error creating task:', error);
    }
}

function populateScanLists() {
    const incompleteContainer = document.getElementById('incomplete-bins');
    incompleteContainer.innerHTML = '';
    
    selectedBins.forEach(bin => {
        const item = document.createElement('div');
        item.className = 'bin-scan-item pending';
        item.dataset.binId = bin.id;
        item.textContent = `${bin.id} (${bin.available} units)`;
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

// Complete task in database
async function completeTask() {
    if (!currentTaskId) return;
    
    try {
        const response = await fetch('/api/tasks/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: currentTaskId })
        });
        
        const result = await response.json();
        if (result.success) {
            console.log('Task completed:', currentTaskId);
        } else if (result.cancelled) {
            // Task was cancelled
            document.getElementById('scan-status').textContent = '❌ Task cancelled by supervisor!';
            document.getElementById('scan-status').style.color = 'red';
            if (html5QrCode) {
                html5QrCode.stop();
            }
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        }
    } catch (error) {
        console.error('Error completing task:', error);
    }
}

function initStep3() {
    document.getElementById('cancel-scan').addEventListener('click', () => {
        if (html5QrCode) {
            html5QrCode.stop();
        }
        window.location.href = 'dashboard.html';
    });
    
    document.getElementById('complete-incoming').addEventListener('click', () => {
        // Save to history
        // TODO: API call to save transaction
        window.location.href = 'dashboard.html';
    });
}
