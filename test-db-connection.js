const { Client } = require('pg');

// Test connection with Hello@123
const client = new Client({
  host: 'itc-warehouse-db-2025.postgres.database.azure.com',
  port: 5432,
  database: 'itc_warehouse',
  user: 'itcadmin',
  password: 'Hello@123',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

async function testConnection() {
  try {
    console.log('🔗 Testing database connection with Hello@123...');
    await client.connect();
    console.log('✅ SUCCESS! Database connection works with Hello@123\n');
    
    const result = await client.query('SELECT COUNT(*) FROM active_skus WHERE is_active = true');
    console.log(`✅ Active SKUs count: ${result.rows[0].count}`);
    
    await client.end();
    
    console.log('\n✅ Database is working fine!');
    console.log('⚠️  Problem is with Azure App Service environment variable.');
    console.log('\nDouble-check in Azure Portal:');
    console.log('1. DB_PASSWORD is exactly: Hello@123 (case-sensitive!)');
    console.log('2. No extra spaces before/after password');
    console.log('3. Applied and Confirmed changes');
    console.log('4. Restarted the app service');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.log('\n🔍 Trying with priyanshu@123...');
    
    const client2 = new Client({
      host: 'itc-warehouse-db-2025.postgres.database.azure.com',
      port: 5432,
      database: 'itc_warehouse',
      user: 'itcadmin',
      password: 'priyanshu@123',
      ssl: { rejectUnauthorized: false }
    });
    
    try {
      await client2.connect();
      console.log('✅ Database works with priyanshu@123');
      console.log('⚠️  You need to REVERT password in Azure to: priyanshu@123');
      await client2.end();
    } catch (err) {
      console.error('❌ priyanshu@123 also failed:', err.message);
    }
  }
}

testConnection();
