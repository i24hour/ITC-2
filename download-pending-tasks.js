// Download Pending_Tasks table to CSV
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: 'itc-warehouse-db-2025.postgres.database.azure.com',
  port: 5432,
  user: 'itcadmin',
  password: 'WareHouse@2025',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function downloadPendingTasks() {
  const client = await pool.connect();
  
  try {
    console.log('📥 Downloading Pending_Tasks table...\n');
    
    // Get all data
    const result = await client.query(`
      SELECT 
        id,
        operator_id,
        task_type,
        sku,
        bin_no,
        cfc,
        weight,
        batch_no,
        created_at,
        expires_at,
        status,
        EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_remaining
      FROM "Pending_Tasks"
      ORDER BY created_at DESC
    `);
    
    console.log(`✅ Found ${result.rows.length} pending tasks\n`);
    
    if (result.rows.length === 0) {
      console.log('ℹ️  No pending tasks to download');
      return;
    }
    
    // Display in console
    console.log('📊 Pending Tasks:');
    console.log('='.repeat(100));
    result.rows.forEach(row => {
      const timeLeft = Math.max(0, Math.floor(row.seconds_remaining));
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      
      console.log(`ID: ${row.id}`);
      console.log(`  Operator: ${row.operator_id}`);
      console.log(`  Type: ${row.task_type}`);
      console.log(`  SKU: ${row.sku}`);
      console.log(`  Bin: ${row.bin_no || 'Not selected'}`);
      console.log(`  CFC: ${row.cfc || 'N/A'}`);
      console.log(`  Weight: ${row.weight || 'N/A'}`);
      console.log(`  Batch: ${row.batch_no || 'N/A'}`);
      console.log(`  Created: ${row.created_at}`);
      console.log(`  Expires: ${row.expires_at}`);
      console.log(`  Status: ${row.status}`);
      console.log(`  Time Remaining: ${minutes}m ${seconds}s`);
      console.log('-'.repeat(100));
    });
    
    // Convert to CSV
    const headers = [
      'ID',
      'Operator ID',
      'Task Type',
      'SKU',
      'Bin No',
      'CFC',
      'Weight',
      'Batch No',
      'Created At',
      'Expires At',
      'Status',
      'Seconds Remaining'
    ];
    
    let csv = headers.join(',') + '\n';
    
    result.rows.forEach(row => {
      const csvRow = [
        row.id,
        row.operator_id,
        row.task_type,
        row.sku,
        row.bin_no || '',
        row.cfc || '',
        row.weight || '',
        row.batch_no || '',
        row.created_at,
        row.expires_at,
        row.status,
        Math.max(0, Math.floor(row.seconds_remaining))
      ];
      csv += csvRow.join(',') + '\n';
    });
    
    // Save to file
    const filename = `Pending_Tasks_${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(filename, csv);
    
    console.log(`\n✅ Downloaded to: ${filename}`);
    console.log(`📁 File size: ${(csv.length / 1024).toFixed(2)} KB`);
    
  } catch (error) {
    console.error('❌ Error downloading Pending_Tasks:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

downloadPendingTasks();
