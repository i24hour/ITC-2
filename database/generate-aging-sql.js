const XLSX = require('xlsx');
const fs = require('fs');

console.log('📖 Reading Excel file...');
const workbook = XLSX.readFile('./BATCHWISE AGE ANALYSIS REPORT.XLS');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const agingMap = new Map();
let processedRows = 0;

for (let i = 8; i < data.length; i++) {
  const row = data[i];
  const sku = row[3]?.toString().trim();
  const aging = parseInt(row[17]);
  
  if (sku && !isNaN(aging)) {
    if (!agingMap.has(sku)) {
      agingMap.set(sku, []);
    }
    agingMap.get(sku).push(aging);
    processedRows++;
  }
}

console.log(`✅ Processed ${processedRows} rows from Excel`);
console.log(`✅ Found ${agingMap.size} unique SKUs with aging data\n`);

// Calculate average aging for each SKU
const skuAgingData = new Map();
for (const [sku, agingValues] of agingMap) {
  const avgAging = Math.round(agingValues.reduce((a, b) => a + b, 0) / agingValues.length);
  skuAgingData.set(sku, avgAging);
}

// Display sample data
console.log('📊 Sample aging data (first 10 SKUs):');
let count = 0;
for (const [sku, aging] of skuAgingData) {
  if (count++ < 10) {
    console.log(`   ${sku}: ${aging} days`);
  }
}
console.log('');

// Generate SQL script
let sql = '-- ================================================================\n';
sql += '-- Add aging_days column to Cleaned_FG_Master_file table\n';
sql += '-- Generated from BATCHWISE AGE ANALYSIS REPORT.XLS\n';
sql += `-- Date: ${new Date().toISOString()}\n`;
sql += `-- Total SKUs: ${skuAgingData.size}\n`;
sql += '-- ================================================================\n\n';

sql += '-- Step 1: Add aging_days column if it does not exist\n';
sql += 'ALTER TABLE "Cleaned_FG_Master_file" \n';
sql += '  ADD COLUMN IF NOT EXISTS aging_days INTEGER DEFAULT NULL;\n\n';

sql += '-- Step 2: Update aging values for each SKU\n';
sql += 'BEGIN;\n\n';

for (const [sku, avgAging] of skuAgingData) {
  const escapedSku = sku.replace(/'/g, "''");
  sql += `UPDATE "Cleaned_FG_Master_file" SET aging_days = ${avgAging} WHERE sku = '${escapedSku}';\n`;
}

sql += '\nCOMMIT;\n\n';

sql += '-- Step 3: Verify the update\n';
sql += 'SELECT \n';
sql += '  COUNT(*) as total_skus,\n';
sql += '  COUNT(aging_days) as skus_with_aging,\n';
sql += '  ROUND(AVG(aging_days)) as avg_aging,\n';
sql += '  MIN(aging_days) as min_aging,\n';
sql += '  MAX(aging_days) as max_aging\n';
sql += 'FROM "Cleaned_FG_Master_file";\n\n';

sql += '-- Step 4: View sample records with aging data\n';
sql += 'SELECT sku, description, aging_days\n';
sql += 'FROM "Cleaned_FG_Master_file"\n';
sql += 'WHERE aging_days IS NOT NULL\n';
sql += 'ORDER BY aging_days DESC\n';
sql += 'LIMIT 20;\n';

fs.writeFileSync('./database/update-aging-column.sql', sql);
console.log('✅ SQL script generated: database/update-aging-column.sql');
console.log(`✅ Total UPDATE statements: ${skuAgingData.size}`);
console.log('\n📝 You can now run this SQL script in:');
console.log('   1. Azure Portal Query Editor');
console.log('   2. pgAdmin');
console.log('   3. Any PostgreSQL client\n');
