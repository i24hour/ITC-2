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
    // TODO: Fetch filtered data from API
    /*
    const response = await fetch(`/api/reports?range=${dateRange}&type=${reportType}`);
    const data = await response.json();
    */
    
    alert(`Generating ${reportType} report for ${dateRange}`);
    // Update tables with filtered data
}

function exportToCSV() {
    // Get table data
    const activityTable = document.getElementById('activity-table-body');
    const rows = activityTable.querySelectorAll('tr');
    
    let csv = 'Timestamp,Type,SKU,Bin ID,Quantity,Operator,Status\n';
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowData = Array.from(cells).map(cell => {
            // Remove badge HTML, get text only
            return cell.textContent.trim();
        });
        csv += rowData.join(',') + '\n';
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

// TODO: Integrate charting library (e.g., Chart.js)
/*
function renderCharts() {
    // Inventory Movement Trend Chart
    const trendCtx = document.getElementById('trend-chart').getContext('2d');
    new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Incoming',
                data: [120, 150, 180, 160],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)'
            }, {
                label: 'Outgoing',
                data: [100, 130, 140, 150],
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)'
            }]
        }
    });
    
    // Top SKUs Bar Chart
    const skuCtx = document.getElementById('sku-chart').getContext('2d');
    new Chart(skuCtx, {
        type: 'bar',
        data: {
            labels: ['SKU001', 'SKU002', 'SKU003', 'SKU004', 'SKU005'],
            datasets: [{
                label: 'Volume',
                data: [450, 380, 320, 280, 250],
                backgroundColor: '#10b981'
            }]
        }
    });
}
*/
