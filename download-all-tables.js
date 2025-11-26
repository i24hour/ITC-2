// Download all database tables to CSV files
const fs = require('fs');

const BASE_URL = 'https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net';

async function downloadAllTables() {
  console.log('📥 Downloading all database tables...\n');
  
  const tables = [
    { name: 'Cleaned_FG_Master_file', endpoint: '/api/admin/download-master-file' },
    { name: 'Inventory', endpoint: '/api/admin/download-inventory' },
    { name: 'Bins', endpoint: '/api/admin/download-bins' },
    { name: 'Operators', endpoint: '/api/admin/download-operators' },
    { name: 'Supervisors', endpoint: '/api/admin/download-supervisors' },
    { name: 'Task_History', endpoint: '/api/admin/download-task-history' },
    { name: 'Incoming', endpoint: '/api/admin/download-incoming' },
    { name: 'Outgoing', endpoint: '/api/admin/download-outgoing' },
    { name: 'Pending_Tasks', endpoint: '/api/admin/download-pending-tasks' }
  ];
  
  const results = {
    success: [],
    failed: [],
    total: tables.length
  };
  
  for (const table of tables) {
    try {
      console.log(`⏳ Downloading ${table.name}...`);
      
      const response = await fetch(`${BASE_URL}${table.endpoint}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const csv = await response.text();
      const filename = `${table.name}_${new Date().toISOString().split('T')[0]}.csv`;
      
      fs.writeFileSync(filename, csv);
      
      const rows = csv.split('\n').length - 2; // Subtract header and empty line
      const size = (csv.length / 1024).toFixed(2);
      
      console.log(`✅ ${table.name}: ${rows} rows, ${size} KB → ${filename}\n`);
      
      results.success.push({
        table: table.name,
        filename,
        rows,
        size
      });
      
    } catch (error) {
      console.error(`❌ ${table.name}: ${error.message}\n`);
      results.failed.push({
        table: table.name,
        error: error.message
      });
    }
  }
  
  // Summary
  console.log('='.repeat(80));
  console.log('📊 DOWNLOAD SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Successful: ${results.success.length}/${results.total}`);
  console.log(`❌ Failed: ${results.failed.length}/${results.total}\n`);
  
  if (results.success.length > 0) {
    console.log('✅ Successfully downloaded:');
    results.success.forEach(item => {
      console.log(`   ${item.table}: ${item.rows} rows → ${item.filename}`);
    });
    console.log('');
  }
  
  if (results.failed.length > 0) {
    console.log('❌ Failed to download:');
    results.failed.forEach(item => {
      console.log(`   ${item.table}: ${item.error}`);
    });
    console.log('');
  }
  
  console.log(`📁 All files saved in: ${process.cwd()}`);
}

downloadAllTables();
