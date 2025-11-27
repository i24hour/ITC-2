const { Client } = require('pg');

// Use the actual credentials from server.js
const client = new Client({
  host: 'itc-warehouse-db-2025.postgres.database.azure.com',
  port: 5432,
  database: 'itc_warehouse',
  user: 'itcadmin',
  password: 'priyanshu@123',
  ssl: {
    rejectUnauthorized: false
  }
});

async function addNewSKUs() {
  try {
    console.log('🔗 Connecting to Azure PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!\n');

    const newSKUs = [
      'FXC10020SA', 'FXC170020S', 'FXC17005S', 'FXC20050S', 
      'FXC30050S', 'FXC60005S', 'FXC73010S', 'FXC73030SA', 
      'FXC74050S', 'FXC75010SA', 'FXC75020SA', 'FXCM'
    ];

    console.log('📝 Adding 12 new SKUs to Cleaned_FG_Master_file...');
    let addedToMaster = 0;
    for (const sku of newSKUs) {
      const result = await client.query(`
        INSERT INTO "Cleaned_FG_Master_file" (sku, description, uom, created_at, expire_in_days)
        VALUES ($1, $2, $3, NOW(), $4)
        ON CONFLICT (sku) DO NOTHING
        RETURNING sku
      `, [sku, sku, 2.0, 365]);
      
      if (result.rowCount > 0) {
        console.log(`   ✅ ${sku}`);
        addedToMaster++;
      } else {
        console.log(`   ⚠️  ${sku} (already exists)`);
      }
    }

    console.log(`\n✅ Added ${addedToMaster} new SKUs to Cleaned_FG_Master_file\n`);

    console.log('📝 Syncing to active_skus table...');
    let addedToActive = 0;
    for (const sku of newSKUs) {
      const result = await client.query(`
        INSERT INTO active_skus (sku, is_active)
        VALUES ($1, $2)
        ON CONFLICT (sku) DO UPDATE SET is_active = $2
        RETURNING sku
      `, [sku, true]);
      
      if (result.rowCount > 0) {
        addedToActive++;
      }
    }

    console.log(`✅ Synced ${addedToActive} SKUs to active_skus\n`);

    // Verify total count
    console.log('🔍 Verifying total active SKUs...');
    const countResult = await client.query(`
      SELECT COUNT(*) as total FROM active_skus WHERE is_active = true
    `);
    console.log(`✅ Total active SKUs: ${countResult.rows[0].total}\n`);

    // Show the new SKUs
    console.log('🔍 Verifying new SKUs in database...');
    const verifyResult = await client.query(`
      SELECT sku, description, uom FROM "Cleaned_FG_Master_file"
      WHERE sku IN ('FXC10020SA', 'FXC170020S', 'FXC17005S', 'FXC20050S', 'FXC30050S', 
                    'FXC60005S', 'FXC73010S', 'FXC73030SA', 'FXC74050S', 'FXC75010SA', 
                    'FXC75020SA', 'FXCM')
      ORDER BY sku
    `);
    
    console.log(`✅ Found ${verifyResult.rows.length}/12 new SKUs:`);
    verifyResult.rows.forEach(row => {
      console.log(`   - ${row.sku} (UOM: ${row.uom})`);
    });

    console.log('\n🎉 SUCCESS! All SKUs added and synced!');
    console.log('👉 Now refresh your browser (Cmd+Shift+R) to see the new SKUs in the dropdown!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error);
  } finally {
    await client.end();
  }
}

addNewSKUs();
