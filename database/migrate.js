const XLSX = require('xlsx');
const path = require('path');
const db = require('./db');
require('dotenv').config();

// Complete SKU List
const SKU_LIST = [
  'FXC10005PB', 'FXC10005SLA', 'FXC10010SA', 'FXC170005PA', 'FXC170005S',
  'FXC170010S', 'FXC20005PA', 'FXC20005SC', 'FXC20010PA', 'FXC20010SA',
  'FXC20015', 'FXC20015S', 'FXC20020IN', 'FXC20020PA', 'FXC20020SA',
  'FXC20030IN', 'FXC30005PA', 'FXC30005SLA', 'FXC30011PA', 'FXC30020IN',
  'FXC40005AF', 'FXC40005PA', 'FXC40005SL', 'FXC40010PB', 'FXC40010SA',
  'FXC40020S', 'FXC50005S', 'FXC60005P', 'FXC70010PA', 'FXC70010S',
  'FXC70020IN', 'FXC70020PA', 'FXC70020SB', 'FXC70020T', 'FXC70030IN',
  'FXC70051S', 'FXC70051T', 'FXC71010PA', 'FXC71010S', 'FXC71020PA',
  'FXC71020SA', 'FXC72010PA', 'FXC72010S', 'FXC72020PA', 'FXC72020SA',
  'FXC72030IN', 'FXC72030PA', 'FXC72030SA', 'FXC73010PA', 'FXC73030IN',
  'FXC75010PA', 'FXC75050PA'
];

const EXCEL_FILE = path.join(__dirname, '..', 'BINGO STOCK  16.10.2025.xlsx');

// Read Excel file
function readExcel() {
  try {
    console.log('📖 Reading Excel file:', EXCEL_FILE);
    const workbook = XLSX.readFile(EXCEL_FILE);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Skip first 2 rows (headers) and convert to proper format
    const data = [];
    let skippedRows = 0;
    
    for (let i = 2; i < rawData.length; i++) {
      const row = rawData[i];
      
      // Check if both Bin No AND SKU exist (both are required fields)
      if (row[0] && row[1] && row[1] !== 'undefined' && row[1].toString().trim() !== '') {
        data.push({
          bin_no: row[0],
          sku: row[1],
          batch_no: row[2] || '',
          description: row[3] || '',
          cfc: parseInt(row[4]) || 0,
          uom: parseFloat(row[5]) || 0,
          qty: parseFloat(row[6]) || 0
        });
      } else {
        skippedRows++;
      }
    }
    
    console.log(`✅ Read ${data.length} valid rows from Excel (${skippedRows} rows skipped due to missing bin_no or sku)`);
    return data;
  } catch (error) {
    console.error('❌ Error reading Excel file:', error);
    throw error;
  }
}

// Initialize database with schema
async function initializeDatabase() {
  const fs = require('fs');
  const schemaPath = path.join(__dirname, 'schema.sql');
  
  try {
    console.log('🔧 Initializing database schema...');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await db.query(schema);
    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// Migrate inventory data
async function migrateInventory(data) {
  const client = await db.getClient();
  
  try {
    console.log('📦 Migrating inventory data...');
    
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Process each row individually with its own transaction
    for (const row of data) {
      try {
        await client.query('BEGIN');
        
        const result = await client.query(
          `INSERT INTO inventory (bin_no, sku, batch_no, description, cfc, uom, qty)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (bin_no, sku) 
           DO UPDATE SET 
             batch_no = EXCLUDED.batch_no,
             description = EXCLUDED.description,
             cfc = EXCLUDED.cfc,
             uom = EXCLUDED.uom,
             qty = EXCLUDED.qty,
             updated_at = CURRENT_TIMESTAMP
           RETURNING (xmax = 0) AS inserted`,
          [row.bin_no, row.sku, row.batch_no, row.description, row.cfc, row.uom, row.qty]
        );
        
        await client.query('COMMIT');
        
        if (result.rows[0].inserted) {
          insertedCount++;
        } else {
          updatedCount++;
        }
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.warn(`⚠️  Skipped row (Bin: ${row.bin_no}, SKU: ${row.sku}): ${error.message}`);
        skippedCount++;
      }
    }
    
    console.log(`✅ Migration complete: ${insertedCount} inserted, ${updatedCount} updated, ${skippedCount} skipped`);
    return { insertedCount, updatedCount, skippedCount };
  } catch (error) {
    console.error('❌ Error migrating inventory:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Initialize active SKUs
async function initializeActiveSKUs() {
  const client = await db.getClient();
  
  try {
    console.log('📋 Initializing active SKUs...');
    await client.query('BEGIN');
    
    for (const sku of SKU_LIST) {
      await client.query(
        `INSERT INTO active_skus (sku, is_active)
         VALUES ($1, true)
         ON CONFLICT (sku) DO NOTHING`,
        [sku]
      );
    }
    
    await client.query('COMMIT');
    console.log(`✅ Initialized ${SKU_LIST.length} active SKUs`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing SKUs:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Main migration function
async function migrate() {
  console.log('\n🚀 Starting database migration...\n');
  
  try {
    // Step 1: Initialize database schema
    await initializeDatabase();
    
    // Step 2: Read Excel data
    const excelData = readExcel();
    
    // Step 3: Migrate inventory data
    await migrateInventory(excelData);
    
    // Step 4: Initialize active SKUs
    await initializeActiveSKUs();
    
    console.log('\n✅ Migration completed successfully!\n');
    
    // Display summary
    const inventoryCount = await db.query('SELECT COUNT(*) FROM inventory');
    const skuCount = await db.query('SELECT COUNT(*) FROM active_skus');
    
    console.log('📊 Database Summary:');
    console.log(`   - Inventory records: ${inventoryCount.rows[0].count}`);
    console.log(`   - Active SKUs: ${skuCount.rows[0].count}`);
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrate();
}

module.exports = { migrate, readExcel };
