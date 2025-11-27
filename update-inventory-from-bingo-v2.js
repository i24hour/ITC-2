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

async function updateInventoryFromBingo() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Step 1: Clear old Inventory table data
    console.log('🗑️  Clearing old Inventory table data...');
    await client.query('DELETE FROM "Inventory"');
    console.log('✅ Old data cleared\n');

    // Step 2: Read BINGO STOCK CSV manually
    console.log('📖 Reading BINGO STOCK  26.11.2025.xlsx - STOCK SHEET.csv...');
    const fileContent = fs.readFileSync('BINGO STOCK  26.11.2025.xlsx - STOCK SHEET.csv', 'utf-8');
    const lines = fileContent.split('\n');
    
    const bingoData = [];
    
    // Find the header line (should have "BIN NO,SKU,BATCH")
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('BIN NO') && lines[i].includes('SKU') && lines[i].includes('BATCH')) {
        headerIndex = i;
        break;
      }
    }
    
    if (headerIndex === -1) {
      console.log('❌ Could not find header row in CSV!');
      return;
    }
    
    console.log(`✅ Found headers at line ${headerIndex + 1}`);
    const headers = lines[headerIndex].split(',').map(h => h.trim());
    console.log('Headers:', headers);
    
    // Get column indices
    const binIndex = headers.findIndex(h => h.includes('BIN'));
    const skuIndex = headers.findIndex(h => h.includes('SKU'));
    const batchIndex = headers.findIndex(h => h.includes('BATCH'));
    const cfcIndex = headers.findIndex(h => h.includes('CFC'));
    
    console.log(`Column indices - BIN:${binIndex}, SKU:${skuIndex}, BATCH:${batchIndex}, CFC:${cfcIndex}\n`);
    
    // Parse data rows
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cols = line.split(',');
      
      const binNo = cols[binIndex] ? cols[binIndex].trim() : '';
      const sku = cols[skuIndex] ? cols[skuIndex].trim() : '';
      const batchNo = cols[batchIndex] ? cols[batchIndex].trim() : '';
      const cfc = cols[cfcIndex] ? cols[cfcIndex].trim() : '';
      
      // Only add if we have required fields
      if (binNo && sku && batchNo && cfc && binNo !== '-' && sku !== '-') {
        bingoData.push({
          bin_no: binNo,
          sku: sku,
          batch_no: batchNo,
          cfc: parseInt(cfc) || 0
        });
      }
    }

    console.log(`✅ Found ${bingoData.length} valid records from BINGO STOCK\n`);

    if (bingoData.length === 0) {
      console.log('⚠️  No valid data found in BINGO STOCK file!');
      console.log('✅ Inventory table is now empty as requested.');
      
      // Download empty table
      const headers = ['ID', 'Bin No', 'SKU', 'Batch No', 'CFC', 'Description', 'UOM', 'Created At', 'Updated At', 'Expire Days'];
      fs.writeFileSync('database/Inventory_2025-11-27.csv', headers.join(',') + '\n');
      console.log('✅ Empty CSV saved to: database/Inventory_2025-11-27.csv');
      return;
    }

    // Step 3: Get SKU details from Cleaned_FG_Master_file
    console.log('📋 Fetching SKU details from master file...');
    const skuDetails = {};
    for (const item of bingoData) {
      if (!skuDetails[item.sku]) {
        const result = await client.query(
          'SELECT description, uom FROM "Cleaned_FG_Master_file" WHERE sku = $1',
          [item.sku]
        );
        if (result.rows.length > 0) {
          skuDetails[item.sku] = {
            description: result.rows[0].description,
            uom: result.rows[0].uom
          };
        } else {
          console.log(`⚠️  SKU ${item.sku} not found in master file, using defaults`);
          skuDetails[item.sku] = {
            description: item.sku,
            uom: 2.0
          };
        }
      }
    }

    // Step 4: Insert into Inventory table
    console.log('\n📝 Inserting data into Inventory table...');
    let insertedCount = 0;
    
    for (const item of bingoData) {
      const details = skuDetails[item.sku];
      
      await client.query(`
        INSERT INTO "Inventory" (bin_no, sku, batch_no, cfc, description, uom, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, [
        item.bin_no,
        item.sku,
        item.batch_no,
        item.cfc,
        details.description,
        details.uom
      ]);
      
      insertedCount++;
      if (insertedCount % 100 === 0) {
        console.log(`   Inserted ${insertedCount} records...`);
      }
    }

    console.log(`\n✅ Successfully inserted ${insertedCount} records into Inventory table!`);

    // Step 5: Download updated Inventory table
    console.log('\n📥 Downloading updated Inventory table...');
    const result = await client.query('SELECT * FROM "Inventory" ORDER BY id');

    const csvHeaders = ['ID', 'Bin No', 'SKU', 'Batch No', 'CFC', 'Description', 'UOM', 'Created At', 'Updated At', 'Expire Days'];
    let csvContent = csvHeaders.join(',') + '\n';

    result.rows.forEach(row => {
      csvContent += [
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

    fs.writeFileSync('database/Inventory_2025-11-27.csv', csvContent);
    console.log('✅ Updated CSV saved to: database/Inventory_2025-11-27.csv');
    console.log(`📊 Total records in Inventory table: ${result.rows.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

updateInventoryFromBingo();
