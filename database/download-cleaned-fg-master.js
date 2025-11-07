const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // Increased to 30 seconds
  ssl: process.env.DB_HOST && process.env.DB_HOST.includes('azure') ? { rejectUnauthorized: false } : false
});

async function downloadTable() {
  console.log('🔌 Connecting to Azure PostgreSQL...');
  console.log(`📍 Host: ${process.env.DB_HOST}`);
  console.log(`📍 Database: ${process.env.DB_NAME}`);
  console.log(`📍 User: ${process.env.DB_USER}\n`);
  
  const client = await pool.connect();
  
  try {
    console.log('✅ Connected successfully!\n');
    console.log('📥 Downloading Cleaned_FG_Master_file table...\n');
    
    const result = await client.query(`
      SELECT sku, description, uom, aging_days, created_at
      FROM "Cleaned_FG_Master_file"
      ORDER BY sku
    `);
    
    console.log(`✅ Fetched ${result.rows.length} records\n`);
    
    if (result.rows.length === 0) {
      console.log('⚠️  Table is empty!');
      return;
    }
    
    // Create CSV content
    const headers = ['SKU', 'Description', 'UOM', 'Aging Days', 'Created At'];
    let csv = headers.join(',') + '\n';
    
    result.rows.forEach(row => {
      const values = [
        row.sku || '',
        `"${(row.description || '').replace(/"/g, '""')}"`, // Escape quotes
        row.uom || '',
        row.aging_days || '',
        row.created_at ? new Date(row.created_at).toISOString() : ''
      ];
      csv += values.join(',') + '\n';
    });
    
    // Save to file in project root
    const filename = `Cleaned_FG_Master_file_export.csv`;
    const filePath = path.join(__dirname, '..', filename);
    fs.writeFileSync(filePath, csv);
    
    console.log('='.repeat(60));
    console.log('✅ CSV FILE DOWNLOADED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`📄 Filename: ${filename}`);
    console.log(`📊 Total Records: ${result.rows.length}`);
    console.log(`💾 File Size: ${(csv.length / 1024).toFixed(2)} KB`);
    console.log('='.repeat(60));
    console.log(`\n📂 File Location: ${filePath}\n`);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check if your IP is whitelisted in Azure PostgreSQL firewall');
    console.error('   2. Verify .env file has correct credentials');
    console.error('   3. Make sure table "Cleaned_FG_Master_file" exists\n');
    throw error;
  } finally {
    client.release();
    await pool.end();
    console.log('🔌 Connection closed\n');
  }
}

downloadTable();
