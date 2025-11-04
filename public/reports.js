// Reports JavaScript

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

    initReports();
});

function initReports() {
    // Generate report button
    document.getElementById('generate-report').addEventListener('click', () => {
        const dateRange = document.getElementById('date-range').value;
        const reportType = document.getElementById('report-type').value;
        
        console.log('Generating report:', { dateRange, reportType });
        generateReport(dateRange, reportType);
    });

    // Export report button
    document.getElementById('export-report').addEventListener('click', () => {
        exportToCSV();
    });

    // Load initial data
    loadReportData();
}

async function loadReportData() {
    // TODO: Fetch from API
    /*
    const response = await fetch('/api/reports/summary');
    const data = await response.json();
    */
    
    // Mock data is already in HTML
    console.log('Loading report data...');
}

async function generateReport(dateRange, reportType) {
    try {
        const reportOutput = document.getElementById('report-output');
        const reportContent = document.getElementById('report-content');
        
        // Show loading state
        reportOutput.style.display = 'block';
        reportContent.innerHTML = '<p style="text-align: center; padding: 40px;">Loading report data...</p>';
        
        // Fetch data from API
        const response = await fetch(`/api/reports?type=${reportType}&dateRange=${dateRange}`);
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to fetch report data');
        }
        
        // Generate report HTML based on type
        let html = '';
        
        if (reportType === 'incoming' || reportType === 'all') {
            html += generateIncomingTable(result.data.incoming || []);
        }
        
        if (reportType === 'outgoing' || reportType === 'all') {
            html += generateOutgoingTable(result.data.outgoing || []);
        }
        
        if (reportType === 'inventory') {
            html += generateInventoryTable(result.data.inventory || []);
        }
        
        if (reportType === 'all') {
            html = '<h3>All Activities Report</h3>' + html;
        }
        
        reportContent.innerHTML = html || '<p style="text-align: center; color: #666;">No data found for selected filters.</p>';
        
    } catch (error) {
        console.error('Error generating report:', error);
        document.getElementById('report-content').innerHTML = 
            `<p style="text-align: center; color: red;">Error loading report: ${error.message}<br/>Please try again.</p>`;
    }
}

function generateIncomingTable(data) {
    if (!data || data.length === 0) {
        return '<p>No incoming records found.</p>';
    }
    
    let html = `
        <h3>📥 Incoming Records (${data.length})</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
                <tr style="background: #f5f5f5; text-align: left;">
                    <th style="padding: 12px; border: 1px solid #ddd;">Date</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">SKU</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Batch No</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Quantity</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Weight (kg)</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Bin No</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Operator</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Description</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    data.forEach(row => {
        const date = new Date(row.incoming_date).toLocaleString();
        html += `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">${date}</td>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>${row.sku}</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.batch_no}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.quantity}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.weight || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.bin_no || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.operator_id || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; font-size: 12px;">${row.description || ''}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    return html;
}

function generateOutgoingTable(data) {
    if (!data || data.length === 0) {
        return '<p>No outgoing records found.</p>';
    }
    
    let html = `
        <h3>📤 Outgoing Records (${data.length})</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
                <tr style="background: #f5f5f5; text-align: left;">
                    <th style="padding: 12px; border: 1px solid #ddd;">Date</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">SKU</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Batch No</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Quantity</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Weight (kg)</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Bin No</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Operator</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Description</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    data.forEach(row => {
        const date = new Date(row.outgoing_date).toLocaleString();
        html += `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">${date}</td>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>${row.sku}</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.batch_no}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.quantity}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.weight || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.bin_no || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.operator_id || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; font-size: 12px;">${row.description || ''}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    return html;
}

function generateInventoryTable(data) {
    if (!data || data.length === 0) {
        return '<p>No inventory records found.</p>';
    }
    
    let html = `
        <h3>📦 Current Inventory (${data.length} bins)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
                <tr style="background: #f5f5f5; text-align: left;">
                    <th style="padding: 12px; border: 1px solid #ddd;">Bin No</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">SKU</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Batch No</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Quantity (CFC)</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">UOM (kg/CFC)</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Weight (kg)</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Description</th>
                    <th style="padding: 12px; border: 1px solid #ddd;">Last Updated</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    data.forEach(row => {
        const updated = new Date(row.updated_at).toLocaleString();
        html += `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>${row.bin_no}</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.sku}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.batch_no}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.quantity}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.uom || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${row.weight || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; font-size: 12px;">${row.description || ''}</td>
                <td style="padding: 10px; border: 1px solid #ddd; font-size: 12px;">${updated}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    return html;
}

function exportToCSV() {
    const reportContent = document.getElementById('report-content');
    const tables = reportContent.querySelectorAll('table');
    
    if (tables.length === 0) {
        alert('Please generate a report first before exporting.');
        return;
    }
    
    let csv = '';
    
    tables.forEach((table, index) => {
        // Add table heading
        const heading = reportContent.querySelectorAll('h3')[index];
        if (heading) {
            csv += heading.textContent + '\n\n';
        }
        
        // Get headers
        const headers = table.querySelectorAll('thead th');
        const headerRow = Array.from(headers).map(th => th.textContent.trim()).join(',');
        csv += headerRow + '\n';
        
        // Get rows
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const rowData = Array.from(cells).map(cell => {
                let text = cell.textContent.trim();
                // Escape commas in text
                if (text.includes(',')) {
                    text = `"${text}"`;
                }
                return text;
            });
            csv += rowData.join(',') + '\n';
        });
        
        csv += '\n\n';
    });
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `itc-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}
