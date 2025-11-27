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

async function downloadInventoryTable() {
  try {
    await client.connect();
    console.log('✅ Connected\n');

    const result = await client.query('SELECT * FROM "Inventory" ORDER BY id');
    console.log(`✅ Found ${result.rows.length} records\n`);

    const headers = ['ID', 'Bin No', 'SKU', 'Batch No', 'CFC', 'Description', 'UOM', 'Created At', 'Updated At', 'Expire Days'];
    let csv = headers.join(',') + '\n';

    result.rows.forEach(row => {
      csv += [
        row.id || '',
        row.bin_no || '',
        row.sku || '',
        row.batch_no || '',
        row.cfc || '',
        '"' + (row.description || '').replace(/"/g, '""') + '"',
        row.uom || '',
        row.created_at || '',
        row.updated_at || '',
        row.expire_days || ''
      ].join(',') + '\n';
    });

    fs.writeFileSync('database/Inventory_2025-11-27.csv', csv);
    console.log('✅ Saved to: database/Inventory_2025-11-27.csv');
    console.log(`📊 Total: ${result.rows.length} records`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

downloadInventoryTable();
