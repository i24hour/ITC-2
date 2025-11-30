const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function updateSupervisorIdAndAdd() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connecting to database...');
    
    // First, alter the supervisor_id column to allow longer values
    console.log('📝 Updating supervisor_id column length...');
    await client.query(`
      ALTER TABLE "Supervisors" 
      ALTER COLUMN supervisor_id TYPE VARCHAR(100);
    `);
    console.log('✅ supervisor_id column updated to VARCHAR(100)');
    
    // Check if password column exists, add if not
    const columns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Supervisors' AND column_name = 'password';
    `);
    
    if (columns.rows.length === 0) {
      console.log('➕ Adding password column...');
      await client.query(`
        ALTER TABLE "Supervisors" 
        ADD COLUMN password VARCHAR(255);
      `);
      console.log('✅ Password column added');
    }
    
    // Now check if sup@gmail.com exists
    const checkSupervisor = await client.query(
      'SELECT * FROM "Supervisors" WHERE supervisor_id = $1',
      ['sup@gmail.com']
    );
    
    if (checkSupervisor.rows.length > 0) {
      console.log('\n⚠️  Supervisor sup@gmail.com already exists. Updating password...');
      
      await client.query(
        'UPDATE "Supervisors" SET password = $1 WHERE supervisor_id = $2',
        ['123', 'sup@gmail.com']
      );
      
      console.log('✅ Password updated for supervisor: sup@gmail.com');
    } else {
      console.log('\n➕ Adding new supervisor...');
      
      await client.query(
        'INSERT INTO "Supervisors" (supervisor_id, name, email, password) VALUES ($1, $2, $3, $4)',
        ['sup@gmail.com', 'Supervisor', 'sup@gmail.com', '123']
      );
      
      console.log('✅ Supervisor added successfully!');
    }
    
    // Display all supervisors
    const allSupervisors = await client.query('SELECT supervisor_id, name, email, password FROM "Supervisors" ORDER BY created_at DESC');
    
    console.log('\n📋 Current Supervisors:');
    console.log('═══════════════════════════════════════════════════════════');
    if (allSupervisors.rows.length === 0) {
      console.log('No supervisors found');
    } else {
      allSupervisors.rows.forEach((sup, index) => {
        console.log(`${index + 1}. ID: ${sup.supervisor_id}, Name: ${sup.name}, Password: ${sup.password || 'N/A'}`);
      });
    }
    console.log('═══════════════════════════════════════════════════════════');
    
    console.log('\n✨ Success! Supervisor credentials:');
    console.log(`   ID/Email: sup@gmail.com`);
    console.log(`   Password: 123`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

updateSupervisorIdAndAdd()
  .then(() => {
    console.log('\n✅ Operation completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Operation failed:', error.message);
    process.exit(1);
  });
