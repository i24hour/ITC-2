const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  host: 'itc-warehouse-db-2025.postgres.database.azure.com',
  port: 5432,
  database: 'itc_warehouse',
  user: 'itcadmin',
  password: 'priyanshu@123',
  ssl: { rejectUnauthorized: false }
});

async function downloadInventory() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    console.log('📥 Fetching Bin_Inventory table...');
    const result = await client.query(`
      SELECT bin_no, sku, batch_no, quantity, status, created_at, updated_at
      FROM "Bin_Inventory"
      ORDER BY bin_no, sku
    `);

    console.log(`✅ Found ${result.rows.length} records\n`);

    // Create CSV header
    let csv = 'bin_no,sku,batch_no,quantity,status,created_at,updated_at\n';

    // Add data rows
    result.rows.forEach(row => {
      csv += `${row.bin_no},${row.sku},${row.batch_no || ''},${row.quantity},${row.status},${row.created_at},${row.updated_at}\n`;
    });

    // Save to file
    const filename = `database/Bin_Inventory_${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(filename, csv);

    console.log(`✅ Saved to: ${filename}`);
    console.log(`📊 Total records: ${result.rows.length}`);
    
    // Show summary
    const summary = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT bin_no) as unique_bins,
        COUNT(DISTINCT sku) as unique_skus,
        SUM(quantity) as total_quantity
      FROM "Bin_Inventory"
    `);
    
    console.log('\n📊 Summary:');
    console.log(`   Total Records: ${summary.rows[0].total_records}`);
    console.log(`   Unique Bins: ${summary.rows[0].unique_bins}`);
    console.log(`   Unique SKUs: ${summary.rows[0].unique_skus}`);
    console.log(`   Total Quantity: ${summary.rows[0].total_quantity}`);

    await client.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

downloadInventory();
