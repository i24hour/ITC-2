const XLSX = require('xlsx');
const fs = require('fs');

console.log('📖 Generating SQL from Excel...\n');

// Read Excel
const workbook = XLSX.readFile('BATCHWISE AGE ANALYSIS REPORT.XLS');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Extract SKU → Aging
const skuAgingMap = new Map();

for (let i = 8; i < data.length; i++) {
  const row = data[i];
  const sku = row[3]?.toString().trim();
  const aging = parseInt(row[17]);
  
  if (sku && !isNaN(aging)) {
    if (!skuAgingMap.has(sku)) {
      skuAgingMap.set(sku, []);
    }
    skuAgingMap.get(sku).push(aging);
  }
}

// Calculate average
const finalMap = new Map();
for (const [sku, agingValues] of skuAgingMap) {
  const avg = Math.round(agingValues.reduce((a, b) => a + b, 0) / agingValues.length);
  finalMap.set(sku, avg);
}

console.log(`✅ Found ${finalMap.size} SKUs\n`);

// Generate SQL
let sql = `-- ============================================
-- AGING COLUMN UPDATE SQL
-- Run this in Azure Portal Query Editor
-- ============================================

-- Step 1: Add column
ALTER TABLE "Cleaned_FG_Master_file" 
ADD COLUMN IF NOT EXISTS aging_days INTEGER DEFAULT NULL;

-- Step 2: Update aging values
BEGIN;

`;

let count = 0;
for (const [sku, aging] of finalMap) {
  const escapedSku = sku.replace(/'/g, "''");
  sql += `UPDATE "Cleaned_FG_Master_file" SET aging_days = ${aging} WHERE sku = '${escapedSku}';\n`;
  count++;
}

sql += `
COMMIT;

-- Step 3: Verify
SELECT 
  COUNT(*) as total_skus,
  COUNT(aging_days) as skus_with_aging,
  AVG(aging_days) as avg_aging,
  MIN(aging_days) as min_aging,
  MAX(aging_days) as max_aging
FROM "Cleaned_FG_Master_file";

-- Show sample
SELECT sku, description, aging_days
FROM "Cleaned_FG_Master_file"
WHERE aging_days IS NOT NULL
ORDER BY aging_days DESC
LIMIT 10;
`;

fs.writeFileSync('AGING_UPDATE.sql', sql);

console.log('✅ SQL file generated: AGING_UPDATE.sql');
console.log(`📊 Total UPDATE statements: ${count}`);
console.log('\n📋 Next steps:');
console.log('1. Open Azure Portal: https://portal.azure.com');
console.log('2. Go to your PostgreSQL database');
console.log('3. Open Query Editor');
console.log('4. Copy-paste content from AGING_UPDATE.sql');
console.log('5. Click Run');
console.log('\n✅ Done!\n');
