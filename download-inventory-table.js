require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function downloadInventoryTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Fetching Inventory table...');
    
    const result = await client.query('SELECT * FROM "Inventory" ORDER BY id DESC');
    
    if (result.rows.length === 0) {
      console.log('⚠️  No data found in Inventory table');
      return;
    }
    
    // Create CSV content
    const headers = Object.keys(result.rows[0]).join(',');
    const rows = result.rows.map(row => 
      Object.values(row).map(val => 
        val === null ? '' : `"${val}"`
      ).join(',')
    );
    
    const csv = [headers, ...rows].join('\n');
    
    // Write to file
    fs.writeFileSync('Inventory_table.csv', csv);
    
    console.log(`✅ Downloaded ${result.rows.length} rows`);
    console.log(`📁 Saved to: Inventory_table.csv`);
    console.log(`📊 Columns: ${headers}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

downloadInventoryTable();
