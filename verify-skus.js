const { Client } = require('pg');

const client = new Client({
  host: 'itc-warehouse-db-2025.postgres.database.azure.com',
  port: 5432,
  database: 'itc_warehouse',
  user: 'itcadmin',
  password: 'priyanshu@123',
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  await client.connect();
  
  // Check if new SKUs are in active_skus
  const result = await client.query(`
    SELECT sku FROM active_skus 
    WHERE sku IN ('FXC10020SA', 'FXC170020S', 'FXC17005S', 'FXC20050S', 'FXC30050S', 
                  'FXC60005S', 'FXC73010S', 'FXC73030SA', 'FXC74050S', 'FXC75010SA', 
                  'FXC75020SA', 'FXCM')
    AND is_active = true
    ORDER BY sku
  `);
  
  console.log(`✅ New SKUs in active_skus: ${result.rows.length}/12`);
  result.rows.forEach(row => console.log(`   - ${row.sku}`));
  
  await client.end();
}

verify();
