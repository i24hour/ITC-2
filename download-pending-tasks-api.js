// Download Pending_Tasks via API
const fs = require('fs');

async function downloadViaAPI() {
  try {
    console.log('📥 Downloading Pending_Tasks table via API...\n');
    
    const response = await fetch('https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/api/admin/download-pending-tasks');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csv = await response.text();
    const filename = `Pending_Tasks_${new Date().toISOString().split('T')[0]}.csv`;
    
    fs.writeFileSync(filename, csv);
    
    console.log(`✅ Downloaded to: ${filename}`);
    console.log(`📁 File size: ${(csv.length / 1024).toFixed(2)} KB`);
    console.log(`📊 Rows: ${csv.split('\n').length - 2}\n`);
    
    // Display preview
    const lines = csv.split('\n');
    console.log('📋 Preview:');
    console.log(lines.slice(0, Math.min(5, lines.length)).join('\n'));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

downloadViaAPI();
