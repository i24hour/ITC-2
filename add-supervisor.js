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

async function addSupervisor() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connecting to database...');
    
    // Check if Supervisors table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'Supervisors'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('📦 Creating Supervisors table...');
      await client.query(`
        CREATE TABLE "Supervisors" (
          id SERIAL PRIMARY KEY,
          supervisor_id VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          email VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Supervisors table created');
    } else {
      console.log('✅ Supervisors table already exists');
    }
    
    // Check if supervisor already exists
    const checkSupervisor = await client.query(
      'SELECT * FROM "Supervisors" WHERE supervisor_id = $1',
      ['sup01']
    );
    
    if (checkSupervisor.rows.length > 0) {
      console.log('⚠️  Supervisor sup01 already exists. Updating password...');
      
      await client.query(
        'UPDATE "Supervisors" SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE supervisor_id = $2',
        ['123', 'sup01']
      );
      
      console.log('✅ Password updated for supervisor: sup01');
    } else {
      console.log('➕ Adding new supervisor...');
      
      await client.query(
        'INSERT INTO "Supervisors" (supervisor_id, password, name) VALUES ($1, $2, $3)',
        ['sup01', '123', 'Supervisor 01']
      );
      
      console.log('✅ Supervisor added successfully!');
    }
    
    // Display all supervisors
    const allSupervisors = await client.query('SELECT supervisor_id, name, created_at FROM "Supervisors" ORDER BY created_at DESC');
    
    console.log('\n📋 Current Supervisors:');
    console.log('═══════════════════════════════════════════════');
    allSupervisors.rows.forEach((sup, index) => {
      console.log(`${index + 1}. ID: ${sup.supervisor_id}, Name: ${sup.name || 'N/A'}, Created: ${sup.created_at}`);
    });
    console.log('═══════════════════════════════════════════════');
    
    console.log('\n✨ Success! Supervisor credentials:');
    console.log(`   ID: sup01`);
    console.log(`   Password: 123`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addSupervisor()
  .then(() => {
    console.log('\n✅ Operation completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Operation failed:', error);
    process.exit(1);
  });
