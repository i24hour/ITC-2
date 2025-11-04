// Outgoing Inventory JavaScript (FIFO System)

let outgoingData = {};
let fifoBins = [];
let html5QrCodeOut;
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

    initStep1Outgoing();
});

// ===== STEP 1: Search SKU =====
function initStep1Outgoing() {
    const form = document.getElementById('outgoing-form');
    const skuInput = document.getElementById('sku-search');
    
    // Load SKU list for autocomplete
    loadSKUListOutgoing(skuInput);
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const sku = document.getElementById('sku-search').value.trim();
        const quantity = parseInt(document.getElementById('dispatch-qty').value);
        const batch = document.getElementById('batch-number').value.trim();

        if (!sku) {
            alert('Please select a SKU');
            return;
        }

        if (!batch) {
            alert('Please enter a Batch Number');
            return;
        }

        outgoingData = { sku, quantity, batch };
        
        await goToStep2Outgoing();
    });
}

// Load available SKUs from server
async function loadSKUListOutgoing(inputElement) {
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

// ===== STEP 2: FIFO Auto Selection =====
async function goToStep2Outgoing() {
    document.getElementById('step1-outgoing').classList.remove('active');
    document.getElementById('step2-outgoing').classList.add('active');
    
    // Set required CFC in status display
    const requiredCfcElement = document.getElementById('required-cfc');
    if (requiredCfcElement) {
        requiredCfcElement.textContent = outgoingData.quantity;
    }
    
    // Fetch bins in FIFO order
    await loadFIFOBins();
    
    // Initialize step 2 buttons
    initStep2Outgoing();
}

// Track selected bins with quantities
let selectedBins = new Map(); // Map of binId -> selectedQuantity
let totalSelectedCFC = 0;

async function loadFIFOBins() {
    try {
        const response = await fetch(`/api/bins/fifo?sku=${outgoingData.sku}&batch=${encodeURIComponent(outgoingData.batch)}`);
        const data = await response.json();
        
        if (!data.bins || data.bins.length === 0) {
            alert(`No match found!\n\nNo bins found with:\n- SKU: ${outgoingData.sku}\n- Batch: ${outgoingData.batch}\n\nPlease verify the SKU and Batch Number.`);
            document.getElementById('step2-outgoing').classList.remove('active');
            document.getElementById('step1-outgoing').classList.add('active');
            return;
        }
        
        // Calculate total available
        const totalAvailable = data.bins.reduce((sum, bin) => sum + bin.quantity, 0);
        
        // Store all bins for manual selection
        fifoBins = data.bins.map(bin => ({
            ...bin,
            toDispatch: 0
        }));

        renderFIFOBins();
    } catch (error) {
        console.error('Error loading FIFO bins:', error);
        alert('Error loading bins. Please try again.');
    }
}

function renderFIFOBins() {
    const container = document.getElementById('fifo-bins-list');
    container.innerHTML = '';
    
    fifoBins.forEach((bin, index) => {
        const binAvailable = Math.round(bin.quantity);
        const binSelected = selectedBins.get(bin.id) || 0;
        const remainingCFC = outgoingData.quantity - totalSelectedCFC;
        // Allow clicking if: (1) bin not selected yet and space available, OR (2) bin already selected (to deselect)
        const isClickable = (remainingCFC > 0 && binSelected === 0) || binSelected > 0;
        
        const binItem = document.createElement('div');
        binItem.className = 'fifo-bin-item';
        binItem.dataset.binId = bin.id;
        binItem.style.cssText = `display: flex; align-items: center; gap: 15px; padding: 15px; border: 2px solid #ddd; border-radius: 8px; margin-bottom: 10px; transition: all 0.3s; cursor: pointer;`;
        
        if (binSelected > 0) {
            binItem.style.borderColor = '#4CAF50';
            binItem.style.backgroundColor = '#e8f5e9';
            binItem.style.opacity = '1';
        } else if (!isClickable) {
            binItem.style.opacity = '0.6';
            binItem.style.cursor = 'not-allowed';
        }
        
        // Bin info
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'flex: 1;';
        infoDiv.innerHTML = `
            <div class="bin-name" style="font-weight: bold; font-size: 18px;">${bin.id}</div>
            <div class="bin-date" style="color: #666; font-size: 14px;">Date: ${bin.date} (${bin.daysOld} days old)</div>
            ${bin.batch ? `<div class="bin-batch" style="color: #666; font-size: 14px;">Batch: ${bin.batch}</div>` : ''}
        `;
        
        // Quantity display
        const qtyDisplayDiv = document.createElement('div');
        qtyDisplayDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 5px;';
        
        // Selected / Available display
        const qtyStatusDiv = document.createElement('div');
        qtyStatusDiv.style.cssText = 'font-weight: bold; font-size: 24px;';
        qtyStatusDiv.innerHTML = `<span style="color: ${binSelected > 0 ? '#4CAF50' : '#999'};">${binSelected}</span> / <span style="color: #666;">${binAvailable}</span>`;
        
        const labelDiv = document.createElement('div');
        labelDiv.style.cssText = 'font-size: 12px; color: #666;';
        labelDiv.textContent = 'Selected / Available';
        
        qtyDisplayDiv.appendChild(qtyStatusDiv);
        qtyDisplayDiv.appendChild(labelDiv);
        
        binItem.appendChild(infoDiv);
        binItem.appendChild(qtyDisplayDiv);
        
        // Click to select/deselect
        binItem.addEventListener('click', () => {
            if (binSelected > 0) {
                // Bin is already selected - clicking will deselect it
                updateBinQuantity(bin, 0);
            } else if (remainingCFC > 0) {
                // Bin is not selected and space available - select it
                const autoSelectQty = Math.min(binAvailable, remainingCFC);
                updateBinQuantity(bin, autoSelectQty);
            }
        });
        
        // Hover effect
        binItem.addEventListener('mouseenter', () => {
            if (binSelected > 0) {
                // Show it can be deselected
                binItem.style.borderColor = '#f44336';
                binItem.style.backgroundColor = '#ffebee';
            } else if (remainingCFC > 0) {
                // Show it can be selected
                binItem.style.borderColor = '#2196F3';
                binItem.style.backgroundColor = '#E3F2FD';
            }
        });
        
        binItem.addEventListener('mouseleave', () => {
            if (binSelected > 0) {
                binItem.style.borderColor = '#4CAF50';
                binItem.style.backgroundColor = '#e8f5e9';
            } else {
                binItem.style.borderColor = '#ddd';
                binItem.style.backgroundColor = 'white';
            }
        });
        
        container.appendChild(binItem);
    });
}

function updateBinQuantity(bin, newQuantity) {
    const binAvailable = Math.round(bin.quantity);
    const currentSelected = selectedBins.get(bin.id) || 0;
    
    // Ensure quantity is within bounds
    if (newQuantity < 0) newQuantity = 0;
    if (newQuantity > binAvailable) newQuantity = binAvailable;
    
    // Calculate remaining CFC capacity
    const remainingCFC = outgoingData.quantity - (totalSelectedCFC - currentSelected);
    if (newQuantity > remainingCFC) {
        newQuantity = remainingCFC;
    }
    
    // Update total
    totalSelectedCFC = totalSelectedCFC - currentSelected + newQuantity;
    
    // Update map
    if (newQuantity > 0) {
        selectedBins.set(bin.id, newQuantity);
    } else {
        selectedBins.delete(bin.id);
    }
    
    // Re-render all bins to update max values
    renderFIFOBins();
    
    // Update selection status
    const selectedCfcElement = document.getElementById('selected-cfc');
    if (selectedCfcElement) {
        selectedCfcElement.textContent = totalSelectedCFC;
    }
    
    // Update status color
    const statusDiv = document.getElementById('selection-status');
    if (statusDiv) {
        if (totalSelectedCFC >= outgoingData.quantity) {
            statusDiv.style.backgroundColor = '#4CAF50';
            statusDiv.style.color = 'white';
        } else if (totalSelectedCFC > 0) {
            statusDiv.style.backgroundColor = '#FFF3CD';
            statusDiv.style.color = '#856404';
        } else {
            statusDiv.style.backgroundColor = '#f5f5f5';
            statusDiv.style.color = '#333';
        }
    }
    
    // Enable/disable proceed button
    updateProceedButton();
}

function updateProceedButton() {
    const proceedBtn = document.getElementById('proceed-to-dispatch');
    const requiredQty = parseInt(outgoingData.quantity);
    const selectedQty = totalSelectedCFC;
    
    console.log('Update Proceed Button:', {
        required: requiredQty,
        selected: selectedQty,
        match: selectedQty === requiredQty
    });
    
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

function initStep2Outgoing() {
    document.getElementById('back-to-search').addEventListener('click', () => {
        document.getElementById('step2-outgoing').classList.remove('active');
        document.getElementById('step1-outgoing').classList.add('active');
        fifoBins = [];
        selectedBins = new Map();
        totalSelectedCFC = 0;
    });
    
    const proceedBtn = document.getElementById('proceed-to-dispatch');
    proceedBtn.addEventListener('click', () => {
        if (totalSelectedCFC === outgoingData.quantity) {
            // Update fifoBins with selected quantities
            fifoBins = fifoBins.filter(bin => selectedBins.has(bin.id)).map(bin => ({
                ...bin,
                toDispatch: selectedBins.get(bin.id)
            }));
            goToStep3Outgoing();
        } else {
            alert(`Please select exactly ${outgoingData.quantity} cartons. Currently selected: ${totalSelectedCFC} cartons`);
        }
    });
    
    // Initially disable proceed button
    updateProceedButton();
}

// ===== STEP 3: Dispatch Scanning =====
async function goToStep3Outgoing() {
    document.getElementById('step2-outgoing').classList.remove('active');
    document.getElementById('step3-outgoing').classList.add('active');
    
    // Create task for supervisor monitoring
    await createOutgoingTask();
    
    // Populate scan lists
    populateDispatchLists();
    
    // Initialize QR scanner
    await initQRScannerOutgoing();
    
    // Initialize step 3 buttons
    initStep3Outgoing();
}

// Create task for supervisor monitoring
async function createOutgoingTask() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        // Prepare bin details as binId:quantity pairs
        // e.g., F37:7,G13:3
        const binDetails = fifoBins.map(b => `${b.id}:${b.toDispatch}`).join(',');

        const response = await fetch('/api/tasks/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operator: user.name || user.email,
                sku: outgoingData.sku,
                binNo: binDetails,
                quantity: outgoingData.quantity,
                type: 'outgoing',
                sessionToken: user.sessionToken || null
            })
        });
        
        const result = await response.json();
        if (result.success) {
            currentTaskId = result.task.id;
            console.log('Outgoing task created:', currentTaskId);
        }
    } catch (error) {
        console.error('Error creating outgoing task:', error);
    }
}

function populateDispatchLists() {
    const incompleteContainer = document.getElementById('incomplete-bins-out');
    incompleteContainer.innerHTML = '';
    
    fifoBins.forEach((bin, index) => {
        const item = document.createElement('div');
        item.className = 'bin-scan-item pending';
        item.dataset.binId = bin.id;
        item.textContent = `#${index + 1} - ${bin.id} (${bin.toDispatch} cartons to dispatch)`;
        incompleteContainer.appendChild(item);
    });
}

async function initQRScannerOutgoing() {
    const statusElement = document.getElementById('scan-status-out');
    
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
        html5QrCodeOut = new Html5Qrcode("qr-reader-out");
        
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
        await html5QrCodeOut.start(
            selectedCamera,
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            onScanSuccessOutgoing,
            onScanErrorOutgoing
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
    const toggleBtn = document.getElementById('toggle-camera-out');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', async () => {
            try {
                const cameras = await Html5Qrcode.getCameras();
                if (cameras && cameras.length > 1) {
                    // Stop current camera
                    if (html5QrCodeOut) {
                        await html5QrCodeOut.stop();
                    }
                    
                    // Start with next camera (simple toggle for now)
                    const currentCameraIndex = cameras.findIndex(c => c.id === selectedCamera);
                    const nextCameraIndex = (currentCameraIndex + 1) % cameras.length;
                    selectedCamera = cameras[nextCameraIndex].id;
                    
                    await html5QrCodeOut.start(
                        selectedCamera,
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 },
                            aspectRatio: 1.0
                        },
                        onScanSuccessOutgoing,
                        onScanErrorOutgoing
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

async function onScanSuccessOutgoing(decodedText, decodedResult) {
    // Check if task has been cancelled
    if (currentTaskId) {
        const isCancelled = await checkTaskCancelled();
        if (isCancelled) {
            document.getElementById('scan-status-out').textContent = '❌ Task cancelled by supervisor!';
            document.getElementById('scan-status-out').style.color = 'red';
            if (html5QrCodeOut) {
                html5QrCodeOut.stop();
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
    
    // Check if the scanned bin is in the FIFO list
    const binItem = matchedBinId ? document.querySelector(`.bin-scan-item[data-bin-id="${matchedBinId}"]`) : null;
    
    if (binItem && binItem.classList.contains('pending')) {
        // Move to complete list
        binItem.classList.remove('pending');
        binItem.classList.add('scanned');
        
        document.getElementById('complete-bins-out').appendChild(binItem);
        
        // Update status
        document.getElementById('scan-status-out').textContent = `✅ ${matchedBinId} dispatched successfully!`;
        document.getElementById('scan-status-out').style.color = '#4CAF50';
        
        // Update bin in database (use the matched bin ID from database)
        dispatchBinInDatabase(matchedBinId);
        
        // Check if all bins are scanned
        checkAllBinsDispatched();
    } else if (binItem && binItem.classList.contains('scanned')) {
        document.getElementById('scan-status-out').textContent = `⚠️ ${matchedBinId} already dispatched`;
        document.getElementById('scan-status-out').style.color = '#FF9800';
    } else {
        document.getElementById('scan-status-out').textContent = `❌ ${decodedText} not in FIFO selection`;
        document.getElementById('scan-status-out').style.color = 'red';
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

function onScanErrorOutgoing(errorMessage) {
    // Ignore continuous scanning errors
}

async function dispatchBinInDatabase(binId) {
    try {
        const bin = fifoBins.find(b => b.id === binId);
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
            console.log('Bin dispatched via secure scan:', result);
        } else {
            console.warn('Dispatch failed:', result);
            document.getElementById('scan-status-out').textContent = `❌ Error: ${result.error || 'Dispatch failed'}`;
            document.getElementById('scan-status-out').style.color = 'red';
        }
    } catch (error) {
        console.error('Error dispatching bin:', error);
        document.getElementById('scan-status-out').textContent = `❌ Network error. Please try again.`;
        document.getElementById('scan-status-out').style.color = 'red';
    }
}

function checkAllBinsDispatched() {
    const pendingBins = document.querySelectorAll('#incomplete-bins-out .bin-scan-item.pending');
    
    if (pendingBins.length === 0) {
        // All bins dispatched - complete the task
        completeOutgoingTask();
        
        document.getElementById('complete-outgoing').style.display = 'inline-flex';
        document.getElementById('scan-status-out').textContent = '✅ All bins dispatched successfully!';
        
        // Stop scanner
        if (html5QrCodeOut) {
            html5QrCodeOut.stop();
        }
    }
}

// Complete task in database
async function completeOutgoingTask() {
    if (!currentTaskId) return;
    
    try {
        const response = await fetch('/api/tasks/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: currentTaskId })
        });
        
        const result = await response.json();
        if (result.success) {
            console.log('Outgoing task completed:', currentTaskId);
        } else if (result.cancelled) {
            // Task was cancelled
            document.getElementById('scan-status-out').textContent = '❌ Task cancelled by supervisor!';
            document.getElementById('scan-status-out').style.color = 'red';
            if (html5QrCodeOut) {
                html5QrCodeOut.stop();
            }
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        }
    } catch (error) {
        console.error('Error completing outgoing task:', error);
    }
}

function initStep3Outgoing() {
    document.getElementById('cancel-dispatch').addEventListener('click', () => {
        if (html5QrCodeOut) {
            html5QrCodeOut.stop();
        }
        window.location.href = 'dashboard.html';
    });
    
    document.getElementById('complete-outgoing').addEventListener('click', () => {
        // Save to history
        // TODO: API call to save transaction
        window.location.href = 'dashboard.html';
    });
}
