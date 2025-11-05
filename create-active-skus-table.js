// Script to create active_skus table in Azure PostgreSQL
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createActiveSKUsTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔗 Connected to Azure PostgreSQL database');
    
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'active_skus'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Table active_skus already exists');
    } else {
      console.log('📋 Creating active_skus table...');
      
      // Create table
      await client.query(`
        CREATE TABLE active_skus (
          sku VARCHAR(50) PRIMARY KEY,
          is_active BOOLEAN DEFAULT true
        );
      `);
      
      console.log('✅ Table created successfully');
    }
    
    // Check how many SKUs are in the table
    const countResult = await client.query(`SELECT COUNT(*) FROM active_skus`);
    const skuCount = parseInt(countResult.rows[0].count);
    
    console.log(`📊 Current SKUs in active_skus table: ${skuCount}`);
    
    if (skuCount === 0) {
      console.log('📥 Populating active_skus from Cleaned_FG_Master_file...');
      
      // Populate with all SKUs from master file
      const insertResult = await client.query(`
        INSERT INTO active_skus (sku, is_active)
        SELECT DISTINCT sku, true
        FROM "Cleaned_FG_Master_file"
        ON CONFLICT (sku) DO NOTHING;
      `);
      
      console.log(`✅ Inserted ${insertResult.rowCount} SKUs into active_skus table`);
      
      // Show final count
      const finalCount = await client.query(`SELECT COUNT(*) FROM active_skus`);
      console.log(`📊 Total SKUs in active_skus: ${finalCount.rows[0].count}`);
      
      // Show sample SKUs
      const sampleSKUs = await client.query(`
        SELECT sku, is_active 
        FROM active_skus 
        ORDER BY sku 
        LIMIT 10
      `);
      
      console.log('\n📋 Sample SKUs:');
      sampleSKUs.rows.forEach(row => {
        console.log(`  ${row.sku} - ${row.is_active ? 'Active' : 'Inactive'}`);
      });
    }
    
    console.log('\n✅ Setup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

createActiveSKUsTable();
