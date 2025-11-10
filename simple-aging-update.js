const XLSX = require('xlsx');
const { Pool } = require('pg');
require('dotenv').config();

console.log('🚀 Simple Aging Column Update\n');
console.log('='.repeat(60));

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 30000,
  ssl: process.env.DB_HOST && process.env.DB_HOST.includes('azure') ? { rejectUnauthorized: false } : false
});

async function simpleAgingUpdate() {
  console.log('📖 Step 1: Reading Excel file...\n');
  
  // Read Excel
  const workbook = XLSX.readFile('BATCHWISE AGE ANALYSIS REPORT.XLS');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Extract SKU → Aging mapping
  const skuAgingMap = new Map();
  
  for (let i = 8; i < data.length; i++) {
    const row = data[i];
    const sku = row[3]?.toString().trim(); // Column D (index 3)
    const aging = parseInt(row[17]); // Column R (index 17)
    
    if (sku && !isNaN(aging)) {
      if (!skuAgingMap.has(sku)) {
        skuAgingMap.set(sku, []);
      }
      skuAgingMap.get(sku).push(aging);
    }
  }
  
  // Calculate average aging for each SKU
  const finalMap = new Map();
  for (const [sku, agingValues] of skuAgingMap) {
    const avg = Math.round(agingValues.reduce((a, b) => a + b, 0) / agingValues.length);
    finalMap.set(sku, avg);
  }
  
  console.log(`✅ Extracted ${finalMap.size} SKUs with aging data from Excel\n`);
  
  // Sample data
  console.log('📊 Sample Excel data (first 5):');
  let count = 0;
  for (const [sku, aging] of finalMap) {
    if (count++ < 5) {
      console.log(`   ${sku} → ${aging} days`);
    }
  }
  console.log('');
  
  // Connect to database
  console.log('🔌 Step 2: Connecting to Azure database...');
  const client = await pool.connect();
  console.log('✅ Connected!\n');
  
  try {
    await client.query('BEGIN');
    
    // Add aging_days column if not exists
    console.log('🔧 Step 3: Adding aging_days column...');
    await client.query(`
      ALTER TABLE "Cleaned_FG_Master_file" 
      ADD COLUMN IF NOT EXISTS aging_days INTEGER DEFAULT NULL
    `);
    console.log('✅ Column added\n');
    
    // Update aging for each SKU
    console.log('📝 Step 4: Updating aging values...');
    let updated = 0;
    let notFound = 0;
    
    for (const [sku, aging] of finalMap) {
      const result = await client.query(
        `UPDATE "Cleaned_FG_Master_file" SET aging_days = $1 WHERE sku = $2`,
        [aging, sku]
      );
      
      if (result.rowCount > 0) {
        updated++;
        if (updated % 10 === 0) {
          process.stdout.write(`\r   Updated: ${updated} SKUs...`);
        }
      } else {
        notFound++;
      }
    }
    
    console.log(`\r   Updated: ${updated} SKUs - Done!    \n`);
    
    await client.query('COMMIT');
    
    // Verify
    console.log('🔍 Step 5: Verifying...');
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(aging_days) as with_aging,
        AVG(aging_days) as avg_aging,
        MIN(aging_days) as min_aging,
        MAX(aging_days) as max_aging
      FROM "Cleaned_FG_Master_file"
    `);
    
    const s = stats.rows[0];
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESS!');
    console.log('='.repeat(60));
    console.log(`📊 Database Statistics:`);
    console.log(`   Total SKUs in database: ${s.total}`);
    console.log(`   SKUs with aging: ${s.with_aging}`);
    console.log(`   SKUs updated: ${updated}`);
    console.log(`   SKUs not found: ${notFound}`);
    console.log(`   Average aging: ${Math.round(s.avg_aging)} days`);
    console.log(`   Min aging: ${s.min_aging} days`);
    console.log(`   Max aging: ${s.max_aging} days`);
    console.log('='.repeat(60));
    
    // Sample updated records
    const sample = await client.query(`
      SELECT sku, description, aging_days
      FROM "Cleaned_FG_Master_file"
      WHERE aging_days IS NOT NULL
      ORDER BY aging_days DESC
      LIMIT 5
    `);
    
    console.log('\n📋 Sample updated records:');
    sample.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.sku} - ${row.aging_days} days`);
    });
    
    console.log('\n✅ All done! Now run: node download-with-retry.js\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

simpleAgingUpdate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
