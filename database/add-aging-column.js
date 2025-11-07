const XLSX = require('xlsx');
const { Pool } = require('pg');
require('dotenv').config();

// Create a direct pool connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 30000, // Increased to 30 seconds
  ssl: process.env.DB_HOST && process.env.DB_HOST.includes('azure') ? { rejectUnauthorized: false } : false
});

async function addAgingColumn() {
  console.log('🔌 Connecting to Azure PostgreSQL...');
  console.log(`📍 Host: ${process.env.DB_HOST}`);
  console.log(`📍 Database: ${process.env.DB_NAME}`);
  console.log(`📍 User: ${process.env.DB_USER}\n`);
  
  const client = await pool.connect();
  console.log('✅ Connected successfully!\n');
  
  try {
    console.log('🔄 Starting aging column addition process...\n');
    
    // Step 1: Read Excel file
    console.log('📖 Reading BATCHWISE AGE ANALYSIS REPORT.XLS...');
    const workbook = XLSX.readFile('./BATCHWISE AGE ANALYSIS REPORT.XLS');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Step 2: Extract SKU-aging pairs (starting from row 8, after header)
    const agingMap = new Map();
    let processedRows = 0;
    
    for (let i = 8; i < data.length; i++) {
      const row = data[i];
      const sku = row[3]?.toString().trim(); // Column D
      const aging = parseInt(row[17]); // Column R
      
      if (sku && !isNaN(aging)) {
        if (!agingMap.has(sku)) {
          agingMap.set(sku, []);
        }
        agingMap.get(sku).push(aging);
        processedRows++;
      }
    }
    
    console.log(`✅ Processed ${processedRows} rows from Excel`);
    console.log(`✅ Found ${agingMap.size} unique SKUs with aging data\n`);
    
    // Step 3: Calculate average aging for each SKU
    const skuAgingData = new Map();
    for (const [sku, agingValues] of agingMap) {
      const avgAging = Math.round(agingValues.reduce((a, b) => a + b, 0) / agingValues.length);
      skuAgingData.set(sku, {
        avgAging: avgAging,
        minAging: Math.min(...agingValues),
        maxAging: Math.max(...agingValues),
        count: agingValues.length
      });
    }
    
    // Display sample data
    console.log('📊 Sample aging data (first 10 SKUs):');
    let sampleCount = 0;
    for (const [sku, data] of skuAgingData) {
      if (sampleCount++ < 10) {
        console.log(`   ${sku}: Avg=${data.avgAging} days, Min=${data.minAging}, Max=${data.maxAging}, Entries=${data.count}`);
      }
    }
    console.log('');
    
    await client.query('BEGIN');
    
    // Step 4: Add aging_days column if it doesn't exist
    console.log('🔧 Adding aging_days column to Cleaned_FG_Master_file...');
    try {
      await client.query(`
        ALTER TABLE "Cleaned_FG_Master_file" 
        ADD COLUMN IF NOT EXISTS aging_days INTEGER DEFAULT NULL
      `);
      console.log('✅ Column added successfully\n');
    } catch (err) {
      console.log('⚠️  Column may already exist, continuing...\n');
    }
    
    // Step 5: Update aging values for each SKU
    console.log('📝 Updating aging values in database...');
    let updatedCount = 0;
    let notFoundCount = 0;
    
    for (const [sku, data] of skuAgingData) {
      try {
        const result = await client.query(
          `UPDATE "Cleaned_FG_Master_file" 
           SET aging_days = $1 
           WHERE sku = $2`,
          [data.avgAging, sku]
        );
        
        if (result.rowCount > 0) {
          updatedCount++;
        } else {
          notFoundCount++;
          console.log(`   ⚠️  SKU not found in database: ${sku}`);
        }
      } catch (err) {
        console.error(`   ❌ Error updating ${sku}:`, err.message);
      }
    }
    
    await client.query('COMMIT');
    
    // Step 6: Verify the update
    console.log('\n🔍 Verifying updates...');
    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as total_skus,
        COUNT(aging_days) as skus_with_aging,
        AVG(aging_days) as avg_aging,
        MIN(aging_days) as min_aging,
        MAX(aging_days) as max_aging
      FROM "Cleaned_FG_Master_file"
    `);
    
    const stats = verifyResult.rows[0];
    
    // Display results
    console.log('\n' + '='.repeat(60));
    console.log('✅ AGING COLUMN ADDITION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`📊 Statistics:`);
    console.log(`   Total SKUs in database: ${stats.total_skus}`);
    console.log(`   SKUs with aging data: ${stats.skus_with_aging}`);
    console.log(`   SKUs updated: ${updatedCount}`);
    console.log(`   SKUs not found: ${notFoundCount}`);
    console.log(`   Average aging: ${Math.round(stats.avg_aging)} days`);
    console.log(`   Min aging: ${stats.min_aging} days`);
    console.log(`   Max aging: ${stats.max_aging} days`);
    console.log('='.repeat(60));
    
    // Display sample updated records
    console.log('\n📋 Sample updated records (first 10):');
    const sampleResult = await client.query(`
      SELECT sku, description, aging_days
      FROM "Cleaned_FG_Master_file"
      WHERE aging_days IS NOT NULL
      ORDER BY aging_days DESC
      LIMIT 10
    `);
    
    sampleResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.sku} - ${row.description.substring(0, 40)}... (${row.aging_days} days)`);
    });
    
    console.log('\n✅ Process completed successfully!\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the function
addAgingColumn().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
