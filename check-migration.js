const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://itc_admin:simpi123@localhost:5432/itc_inventory',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function checkTables() {
  try {
    // Check if Bin_Holds table exists
    const tableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'Bin_Holds'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ Bin_Holds table does NOT exist!');
      console.log('You need to run the migration first.');
      console.log('Run this in browser console: fetch("/api/admin/run-task-migration", {method:"POST"})');
    } else {
      console.log('✅ Bin_Holds table exists');
      
      // Check Bins table columns
      const binsColumns = await pool.query(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'Bins' AND column_name IN ('cfc_capacity', 'cfc_held')
      `);
      console.log(`\nBins table columns: ${binsColumns.rows.map(r => r.column_name).join(', ')}`);
      
      if (binsColumns.rows.length < 2) {
        console.log('❌ Bins table missing cfc_capacity or cfc_held columns!');
        console.log('Run migration: fetch("/api/admin/run-task-migration", {method:"POST"})');
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkTables();
