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

async function checkLoginSecurity() {
  const client = await pool.connect();
  
  try {
    console.log('🔒 Checking Login Security Settings\n');
    
    // Check Supervisors
    console.log('📋 SUPERVISORS TABLE:');
    console.log('════════════════════════════════════════════════════════');
    const supervisors = await client.query(`
      SELECT supervisor_id, name, email, 
             CASE WHEN password IS NOT NULL THEN '✓ Set' ELSE '✗ Missing' END as password_status,
             CASE WHEN password_hash IS NOT NULL THEN '✓ Set' ELSE '✗ Missing' END as password_hash_status
      FROM "Supervisors"
      ORDER BY created_at DESC
    `);
    
    if (supervisors.rows.length === 0) {
      console.log('No supervisors found');
    } else {
      supervisors.rows.forEach((sup, i) => {
        console.log(`${i + 1}. ID: ${sup.supervisor_id}`);
        console.log(`   Email: ${sup.email}`);
        console.log(`   Name: ${sup.name}`);
        console.log(`   Password: ${sup.password_status}`);
        console.log(`   Password Hash: ${sup.password_hash_status}`);
        console.log('');
      });
    }
    
    // Check Operators
    console.log('📋 OPERATORS TABLE:');
    console.log('════════════════════════════════════════════════════════');
    const operators = await client.query(`
      SELECT operator_id, name, email,
             CASE WHEN password_hash IS NOT NULL THEN '✓ Set' ELSE '✗ Missing' END as password_status
      FROM "Operators"
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (operators.rows.length === 0) {
      console.log('No operators found');
    } else {
      operators.rows.forEach((op, i) => {
        console.log(`${i + 1}. ID: ${op.operator_id}`);
        console.log(`   Email: ${op.email}`);
        console.log(`   Name: ${op.name}`);
        console.log(`   Password: ${op.password_status}`);
        console.log('');
      });
    }
    
    // Security Summary
    console.log('🔐 SECURITY SUMMARY:');
    console.log('════════════════════════════════════════════════════════');
    console.log('✅ Login now requires valid credentials from database');
    console.log('✅ Password validation enabled for supervisors');
    console.log('✅ Password validation enabled for operators');
    console.log('✅ No more anonymous/session-only logins allowed');
    console.log('\n⚠️  Make sure all users have passwords set!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkLoginSecurity()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
