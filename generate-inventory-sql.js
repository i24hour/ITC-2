const fs = require('fs');

console.log('📥 Reading BINGO STOCK file...');

// Read the CSV file
const csvData = fs.readFileSync('BINGO STOCK  26.11.2025.xlsx - STOCK SHEET.csv', 'utf-8');
const lines = csvData.split('\n');
const dataLines = lines.slice(3).filter(line => line.trim()); // Skip header lines

console.log(`📊 Found ${dataLines.length} rows in BINGO STOCK file`);

// Parse CSV data
const inventoryData = [];
for (const line of dataLines) {
  const parts = line.split(',');
  
  const binNo = parts[0]?.trim();
  const sku = parts[1]?.trim();
  const batch = parts[2]?.trim();
  const description = parts[3]?.trim() || '0';
  const cfc = parts[4]?.trim();
  const uom = parts[5]?.trim();
  
  // Skip empty bins or rows with no SKU
  if (!binNo || !sku || sku === '0' || !batch) {
    continue;
  }
  
  inventoryData.push({
    bin_no: binNo,
    sku: sku,
    batch_no: batch,
    description: description,
    cfc: cfc || '0',
    uom: uom || '-'
  });
}

console.log(`✅ Parsed ${inventoryData.length} valid inventory records`);
console.log('\n📝 Generating SQL statements...');

// Generate SQL
let sql = `-- Clear old inventory\nDELETE FROM "Bin_Inventory";\n\n`;

// Collect unique bins
const uniqueBins = new Set(inventoryData.map(item => item.bin_no));
sql += `-- Create missing bins\n`;
for (const binNo of uniqueBins) {
  const escapedBin = binNo.replace(/'/g, "''");
  sql += `INSERT INTO "Bins" (bin_no, status) VALUES ('${escapedBin}', 'empty') ON CONFLICT (bin_no) DO NOTHING;\n`;
}

sql += `\n-- Insert new inventory data\n`;

for (const item of inventoryData) {
  const binNo = item.bin_no.replace(/'/g, "''");
  const sku = item.sku.replace(/'/g, "''");
  const batch = item.batch_no.replace(/'/g, "''");
  const quantity = parseInt(item.cfc) || 0;
  
  sql += `INSERT INTO "Bin_Inventory" (bin_no, sku, batch_no, quantity, status) VALUES ('${binNo}', '${sku}', '${batch}', ${quantity}, 'active');\n`;
}

// Write to file
fs.writeFileSync('update-inventory.sql', sql);

console.log(`\n✅ SQL file generated: update-inventory.sql`);
console.log(`📊 Total INSERT statements: ${inventoryData.length}`);
console.log(`\n💡 You can now:`);
console.log(`   1. Open Azure Portal → PostgreSQL → Query editor`);
console.log(`   2. Copy and paste the SQL from update-inventory.sql`);
console.log(`   3. Execute the queries\n`);
