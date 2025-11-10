// Quick script to add FXC1100PB to active_skus table

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function syncSKU() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Adding FXC1100PB to active_skus table...');
    
    const result = await client.query(`
      INSERT INTO active_skus (sku, is_active)
      VALUES ('FXC1100PB', true)
      ON CONFLICT (sku) DO UPDATE SET is_active = true
      RETURNING sku, is_active
    `);
    
    console.log('✅ Success!', result.rows[0]);
    console.log('✅ FXC1100PB is now active and will appear in incoming/outgoing dropdowns');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

syncSKU();
