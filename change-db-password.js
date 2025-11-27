const { Client } = require('pg');

// Connect with current password
const client = new Client({
  host: 'itc-warehouse-db-2025.postgres.database.azure.com',
  port: 5432,
  database: 'itc_warehouse',
  user: 'itcadmin',
  password: 'Hello@123',
  ssl: { rejectUnauthorized: false }
});

async function changePassword() {
  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('🔐 Changing password to: priyanshu@123');
    await client.query(`ALTER USER itcadmin WITH PASSWORD 'priyanshu@123'`);
    console.log('✅ Password changed successfully!\n');

    console.log('🔍 Verifying new password...');
    await client.end();
    
    // Test with new password
    const testClient = new Client({
      host: 'itc-warehouse-db-2025.postgres.database.azure.com',
      port: 5432,
      database: 'itc_warehouse',
      user: 'itcadmin',
      password: 'priyanshu@123',
      ssl: { rejectUnauthorized: false }
    });
    
    await testClient.connect();
    const result = await testClient.query('SELECT COUNT(*) FROM active_skus WHERE is_active = true');
    console.log(`✅ Login successful with new password!`);
    console.log(`✅ Active SKUs: ${result.rows[0].count}`);
    await testClient.end();
    
    console.log('\n🎉 SUCCESS! Database password changed to: priyanshu@123');
    console.log('👉 Now your site will work automatically!');
    console.log('👉 Wait 10 seconds and refresh your browser!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

changePassword();
