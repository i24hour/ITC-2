const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  host: 'itc-warehouse-db-2025.postgres.database.azure.com',
  port: 5432,
  database: 'itc_warehouse_db',
  user: 'azureuser',
  password: 'ITC@2025Secure',
  ssl: {
    rejectUnauthorized: false
  }
});

async function executeSql() {
  try {
    await client.connect();
    console.log('✅ Connected to Azure PostgreSQL');
    
    const sql = fs.readFileSync('database/add-new-skus-fixed.sql', 'utf8');
    
    console.log('\n📝 Executing SQL...');
    const result = await client.query(sql);
    console.log('✅ SQL executed successfully!');
    console.log(`   Rows affected: ${result.rowCount || 'N/A'}`);
    
    // Verify
    console.log('\n🔍 Verifying new SKUs...');
    const verify = await client.query(`
      SELECT sku FROM "Cleaned_FG_Master_file" 
      WHERE sku IN ('FXC10020SA', 'FXC170020S', 'FXC17005S', 'FXC20050S', 'FXC30050S', 'FXC60005S', 'FXC73010S', 'FXC73030SA', 'FXC74050S', 'FXC75010SA', 'FXC75020SA', 'FXCM')
      ORDER BY sku
    `);
    console.log(`✅ Found ${verify.rows.length}/12 new SKUs in database`);
    verify.rows.forEach(row => console.log(`   - ${row.sku}`));
    
    // Check active_skus
    console.log('\n🔍 Checking active_skus table...');
    const active = await client.query(`
      SELECT COUNT(*) as count FROM active_skus WHERE is_active = true
    `);
    console.log(`✅ Total active SKUs: ${active.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

executeSql();
