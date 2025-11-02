const API_BASE = 'http://localhost:3000/api';

let currentSearch = {
    sku: '',
    value: 0,
    bins: []
};

// Load SKUs on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSKUs();
    setupEventListeners();
});

// Load available SKUs
async function loadSKUs() {
    try {
        const response = await fetch(`${API_BASE}/skus`);
        const skus = await response.json();
        
        const select = document.getElementById('sku-select');
        select.innerHTML = '<option value="">Select a SKU</option>';
        
        skus.forEach(sku => {
            const option = document.createElement('option');
            option.value = sku;
            option.textContent = sku;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading SKUs:', error);
        alert('Failed to load SKUs. Make sure the server is running.');
    }
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('search-btn').addEventListener('click', searchBins);
    
    // Modal close
    const modal = document.getElementById('qr-modal');
    const closeBtn = document.querySelector('.close');
    closeBtn.addEventListener('click', () => {
        stopScanPolling();
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            stopScanPolling();
            modal.style.display = 'none';
        }
    });
    
    // Return home button
    document.getElementById('return-home-btn').addEventListener('click', () => {
        document.getElementById('qr-modal').style.display = 'none';
        resetToHomePage();
    });
}

// Search bins
async function searchBins() {
    const sku = document.getElementById('sku-select').value;
    const value = document.getElementById('value-input').value;
    
    if (!sku) {
        alert('Please select a SKU');
        return;
    }
    
    if (!value || value < 0) {
        alert('Please enter a valid value');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/search-bins`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sku, value })
        });
        
        const bins = await response.json();
        
        currentSearch = { sku, value: parseInt(value), bins };
        displayBins(bins, sku);
    } catch (error) {
        console.error('Error searching bins:', error);
        alert('Failed to search bins. Make sure the server is running.');
    }
}

// Display bins
function displayBins(bins, sku) {
    const container = document.getElementById('bins-container');
    const resultsSection = document.getElementById('results-section');
    
    if (bins.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No bins found with the specified criteria.</p>';
        resultsSection.style.display = 'block';
        return;
    }
    
    container.innerHTML = '';
    
    bins.forEach(bin => {
        const card = document.createElement('div');
        card.className = 'bin-card';
        card.innerHTML = `
            <h3>${bin['Bin No.']}</h3>
            <div class="sku-info">SKU: ${sku}</div>
            <div class="value-info">📦 ${bin[sku]} units</div>
        `;
        
        card.addEventListener('click', () => {
            showQRCode(bin['Bin No.'], sku, bin[sku]);
        });
        
        container.appendChild(card);
    });
    
    resultsSection.style.display = 'block';
}

// Polling interval variable
let scanPollingInterval = null;

// Show QR code modal
async function showQRCode(binNo, sku, currentValue) {
    const modal = document.getElementById('qr-modal');
    const qrContainer = document.getElementById('qr-code-container');
    
    document.getElementById('modal-bin-name').textContent = binNo;
    document.getElementById('modal-sku').textContent = sku;
    document.getElementById('modal-current-value').textContent = currentValue;
    document.getElementById('modal-subtract-value').textContent = currentSearch.value;
    
    // Reset UI elements
    const scanResult = document.getElementById('scan-result');
    scanResult.style.display = 'none';
    scanResult.className = 'scan-result';
    document.getElementById('scan-instructions').style.display = 'block';
    document.getElementById('scan-success-actions').style.display = 'none';
    
    // Store current bin info
    modal.dataset.binNo = binNo;
    modal.dataset.sku = sku;
    modal.dataset.value = currentSearch.value;
    modal.dataset.originalValue = currentValue;
    
    try {
        const response = await fetch(`${API_BASE}/generate-qr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ binNo, sku, value: currentSearch.value })
        });
        
        const data = await response.json();
        qrContainer.innerHTML = `<img src="${data.qrCode}" alt="QR Code" />`;
        modal.style.display = 'block';
        
        // Start polling to detect scan from phone
        startScanPolling(binNo, sku, currentValue);
    } catch (error) {
        console.error('Error generating QR code:', error);
        alert('Failed to generate QR code.');
    }
}

// Reset to home page
function resetToHomePage() {
    // Reset form
    document.getElementById('sku-select').value = '';
    document.getElementById('value-input').value = '';
    
    // Hide results section
    document.getElementById('results-section').style.display = 'none';
    
    // Clear bins container
    document.getElementById('bins-container').innerHTML = '';
    
    // Reset current search
    currentSearch = { sku: '', value: 0, bins: [] };
}

// Start polling to detect scan from phone
function startScanPolling(binNo, sku, originalValue) {
    // Clear any existing polling
    if (scanPollingInterval) {
        clearInterval(scanPollingInterval);
    }
    
    // Poll every 2 seconds to check if value changed
    scanPollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/inventory`);
            const data = await response.json();
            
            // Find the bin
            const bin = data.find(row => row['Bin No.'] === binNo);
            if (bin) {
                const currentValue = parseInt(bin[sku] || 0);
                
                // Check if value decreased (scan happened)
                if (currentValue < originalValue) {
                    // Stop polling
                    clearInterval(scanPollingInterval);
                    scanPollingInterval = null;
                    
                    // Show success message
                    showScanSuccess(binNo, sku, originalValue, currentValue);
                }
            }
        } catch (error) {
            console.error('Error checking inventory:', error);
        }
    }, 2000);
}

// Show scan success message
function showScanSuccess(binNo, sku, previousValue, newValue) {
    const modal = document.getElementById('qr-modal');
    const subtractedValue = modal.dataset.value;
    
    // Hide scanning instructions
    document.getElementById('scan-instructions').style.display = 'none';
    
    // Show success message
    const scanResult = document.getElementById('scan-result');
    scanResult.className = 'scan-result success';
    scanResult.style.display = 'block';
    scanResult.innerHTML = `
        <strong>✅ Scan Successful!</strong><br>
        Bin: ${binNo}<br>
        SKU: ${sku}<br>
        Previous Value: ${previousValue}<br>
        Subtracted: ${subtractedValue}<br>
        New Value: ${newValue}
    `;
    
    // Show return home button
    document.getElementById('scan-success-actions').style.display = 'block';
}

// Stop polling when modal closes
function stopScanPolling() {
    if (scanPollingInterval) {
        clearInterval(scanPollingInterval);
        scanPollingInterval = null;
    }
}
