const fs = require('fs');

console.log('📥 Reading files...');

// Read BINGO STOCK CSV
const bingoData = fs.readFileSync('BINGO STOCK  26.11.2025.xlsx - STOCK SHEET.csv', 'utf-8');
const bingoLines = bingoData.split('\n').slice(3).filter(line => line.trim());

// Read Cleaned_FG_Master_file CSV
const masterData = fs.readFileSync('database/Cleaned_FG_Master_file_2025-11-26.csv', 'utf-8');
const masterLines = masterData.split('\n');
const masterHeader = masterLines[0];

// Extract existing SKUs from master file
const existingSKUs = new Set();
for (let i = 1; i < masterLines.length; i++) {
  const line = masterLines[i].trim();
  if (line) {
    const sku = line.split(',')[0];
    if (sku) {
      existingSKUs.add(sku);
    }
  }
}

console.log(`✅ Found ${existingSKUs.size} existing SKUs in master file`);

// Extract unique SKUs from BINGO STOCK
const bingoSKUs = new Set();
for (const line of bingoLines) {
  const parts = line.split(',');
  const sku = parts[1]?.trim();
  
  // Skip empty or invalid SKUs
  if (sku && sku !== '0' && sku !== '') {
    bingoSKUs.add(sku);
  }
}

console.log(`📊 Found ${bingoSKUs.size} unique SKUs in BINGO STOCK`);

// Find new SKUs (in BINGO but not in master)
const newSKUs = [...bingoSKUs].filter(sku => !existingSKUs.has(sku));

console.log(`\n🆕 Found ${newSKUs.length} new SKUs to add:`);
newSKUs.forEach(sku => console.log(`   - ${sku}`));

// Generate new CSV with added SKUs
let updatedCSV = masterHeader + '\n';

// Add existing records
for (let i = 1; i < masterLines.length; i++) {
  const line = masterLines[i].trim();
  if (line) {
    updatedCSV += line + '\n';
  }
}

// Add new SKUs with empty description, uom, created_at, expire_in_days
for (const sku of newSKUs.sort()) {
  updatedCSV += `${sku},,,\n`;
}

// Write updated file
fs.writeFileSync('database/Cleaned_FG_Master_file_2025-11-26_UPDATED.csv', updatedCSV);

console.log('\n✅ Updated file saved: database/Cleaned_FG_Master_file_2025-11-26_UPDATED.csv');
console.log(`📊 Total SKUs now: ${existingSKUs.size + newSKUs.length}`);
console.log(`   - Existing: ${existingSKUs.size}`);
console.log(`   - New: ${newSKUs.length}`);

// Generate SQL to update the database
let sql = `-- Add new SKUs to Cleaned_FG_Master_file table\n\n`;

for (const sku of newSKUs.sort()) {
  sql += `INSERT INTO "Cleaned_FG_Master_file" (sku, description, uom, created_at, expire_in_days) VALUES ('${sku}', NULL, NULL, NOW(), NULL) ON CONFLICT (sku) DO NOTHING;\n`;
}

fs.writeFileSync('database/add-new-skus.sql', sql);
console.log('\n✅ SQL file generated: database/add-new-skus.sql');
console.log(`   Contains ${newSKUs.length} INSERT statements`);
