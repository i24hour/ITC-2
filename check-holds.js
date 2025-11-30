const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://itc_admin:simpi123@localhost:5432/itc_inventory',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function checkHolds() {
  try {
    console.log('\n=== ACTIVE HOLDS ===');
    const holds = await pool.query(`
      SELECT * FROM "Bin_Holds" 
      WHERE status = 'active' 
      ORDER BY created_at DESC
    `);
    console.log(`Found ${holds.rows.length} active holds:`);
    holds.rows.forEach(h => {
      console.log(`- Bin: ${h.bin_no}, CFC: ${h.cfc_held}, Task ID: ${h.task_id}, Created: ${h.created_at}`);
    });

    console.log('\n=== PENDING TASKS ===');
    const tasks = await pool.query(`
      SELECT id, operator_id, task_type, sku, expires_at, status, created_at 
      FROM "Pending_Tasks" 
      ORDER BY created_at DESC
    `);
    console.log(`Found ${tasks.rows.length} pending tasks:`);
    tasks.rows.forEach(t => {
      console.log(`- ID: ${t.id}, Status: ${t.status}, Expires: ${t.expires_at}, Created: ${t.created_at}`);
    });

    console.log('\n=== BINS STATUS ===');
    const bins = await pool.query(`
      SELECT bin_no, cfc_capacity, cfc_held, cfc_filled 
      FROM "Bins" 
      WHERE cfc_held > 0 OR bin_no = 'A01'
      ORDER BY bin_no
    `);
    console.log(`Bins with holds or A01:`);
    bins.rows.forEach(b => {
      const available = (b.cfc_capacity || 240) - (b.cfc_filled || 0) - (b.cfc_held || 0);
      console.log(`- ${b.bin_no}: Capacity=${b.cfc_capacity}, Filled=${b.cfc_filled}, Held=${b.cfc_held}, Available=${available}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkHolds();
