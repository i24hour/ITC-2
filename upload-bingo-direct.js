const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 1
});

async function uploadBingoInventory() {
  const client = await pool.connect();
  
  try {
    console.log('📥 Reading BINGO STOCK file...');
    
    // Read the CSV file
    const csvData = fs.readFileSync('BINGO STOCK  26.11.2025.xlsx - STOCK SHEET.csv', 'utf-8');
    const lines = csvData.split('\n');
    const dataLines = lines.slice(3).filter(line => line.trim()); // Skip header lines
    
    console.log(`📊 Found ${dataLines.length} rows in BINGO STOCK file`);
    
    // Parse CSV data
    const inventoryData = [];
    for (const line of dataLines) {
      const parts = line.split(',');
      
      const binNo = parts[0]?.trim();
      const sku = parts[1]?.trim();
      const batch = parts[2]?.trim();
      const description = parts[3]?.trim() || '0';
      const cfc = parts[4]?.trim();
      const uom = parts[5]?.trim();
      
      // Skip empty bins or rows with no SKU
      if (!binNo || !sku || sku === '0' || !batch) {
        continue;
      }
      
      inventoryData.push({
        bin_no: binNo,
        sku: sku,
        batch_no: batch,
        description: description,
        cfc: cfc || '0',
        uom: uom || '-'
      });
    }
    
    console.log(`✅ Parsed ${inventoryData.length} valid inventory records`);
    console.log(`\n🗑️  Clearing old Inventory data...`);
    
    // Clear old inventory data
    const deleteResult = await client.query('DELETE FROM "Bin_Inventory"');
    console.log(`✅ Deleted ${deleteResult.rowCount} old records`);
    
    console.log(`\n📝 Inserting new inventory data...`);
    
    // Insert new inventory data
    let insertedCount = 0;
    for (const item of inventoryData) {
      await client.query(`
        INSERT INTO "Bin_Inventory" (bin_no, sku, batch_no, cfc, description, uom, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, [
        item.bin_no,
        item.sku,
        item.batch_no,
        item.cfc,
        item.description,
        item.uom
      ]);
      insertedCount++;
      
      if (insertedCount % 100 === 0) {
        console.log(`   Inserted ${insertedCount}/${inventoryData.length} records...`);
      }
    }
    
    console.log(`\n✅ Successfully inserted ${insertedCount} inventory records`);
    
    // Get summary
    const summary = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT bin_no) as unique_bins,
        COUNT(DISTINCT sku) as unique_skus
      FROM "Bin_Inventory"
    `);
    
    console.log('\n📊 INVENTORY UPDATE SUMMARY:');
    console.log('================================================================================');
    console.log(`Total Records: ${summary.rows[0].total_records}`);
    console.log(`Unique Bins: ${summary.rows[0].unique_bins}`);
    console.log(`Unique SKUs: ${summary.rows[0].unique_skus}`);
    console.log('================================================================================\n');
    
    // Show sample data
    const sampleData = await client.query(`
      SELECT bin_no, sku, batch_no, cfc
      FROM "Bin_Inventory"
      ORDER BY bin_no
      LIMIT 10
    `);
    
    console.log('📋 Sample data (first 10 records):');
    console.table(sampleData.rows);
    
  } catch (error) {
    console.error('❌ Error updating inventory:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the update
uploadBingoInventory()
  .then(() => {
    console.log('\n✅ Inventory update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to update inventory:', error);
    process.exit(1);
  });
