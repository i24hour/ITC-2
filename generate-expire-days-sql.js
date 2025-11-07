const XLSX = require('xlsx');

console.log('🔧 Generating SQL for expire_in_days...\n');

// Read Excel
const workbook = XLSX.readFile('BATCHWISE AGE ANALYSIS REPORT.XLS');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Extract SKU, MFD date, Expiry date
const skuDateMap = new Map();

for (let i = 8; i < data.length; i++) {
  const row = data[i];
  const sku = row[3]?.toString().trim(); // Column D
  const mfdDate = row[16]; // Column Q - Date of mfd
  const expiryDate = row[18]; // Column S - Date of expiry
  
  if (sku && mfdDate && expiryDate) {
    // Parse dates (format: DD.MM.YYYY)
    const parseMFD = mfdDate.toString().split('.');
    const parseExpiry = expiryDate.toString().split('.');
    
    if (parseMFD.length === 3 && parseExpiry.length === 3) {
      const mfd = new Date(parseMFD[2], parseMFD[1] - 1, parseMFD[0]);
      const expiry = new Date(parseExpiry[2], parseExpiry[1] - 1, parseExpiry[0]);
      
      // Calculate days difference
      const diffTime = expiry - mfd;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (!skuDateMap.has(sku)) {
        skuDateMap.set(sku, []);
      }
      
      skuDateMap.get(sku).push({
        mfd: mfd.toISOString().split('T')[0],
        expiry: expiry.toISOString().split('T')[0],
        days: diffDays
      });
    }
  }
}

// Calculate average for each SKU
const finalMap = new Map();
for (const [sku, entries] of skuDateMap) {
  const avgDays = Math.round(entries.reduce((a, b) => a + b.days, 0) / entries.length);
  // Use most recent dates
  const latest = entries[entries.length - 1];
  finalMap.set(sku, {
    mfd: latest.mfd,
    expiry: latest.expiry,
    days: avgDays
  });
}

console.log(`✅ Found ${finalMap.size} SKUs with date data\n`);

// Sample
console.log('📊 Sample data (first 5):');
let count = 0;
for (const [sku, data] of finalMap) {
  if (count++ < 5) {
    console.log(`   ${sku}: MFD=${data.mfd}, Expiry=${data.expiry}, Days=${data.days}`);
  }
}
console.log('');

// Generate SQL
const fs = require('fs');
let sql = `-- ============================================
-- REPLACE aging_days WITH expire_in_days
-- Run this in Azure Portal Query Editor
-- ============================================

-- Step 1: Drop old column
ALTER TABLE "Cleaned_FG_Master_file" DROP COLUMN IF EXISTS aging_days;

-- Step 2: Add new columns
ALTER TABLE "Cleaned_FG_Master_file" 
ADD COLUMN IF NOT EXISTS mfd_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS expiry_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS expire_in_days INTEGER DEFAULT NULL;

-- Step 3: Update values
BEGIN;

`;

for (const [sku, data] of finalMap) {
  const escapedSku = sku.replace(/'/g, "''");
  sql += `UPDATE "Cleaned_FG_Master_file" SET mfd_date = '${data.mfd}', expiry_date = '${data.expiry}', expire_in_days = ${data.days} WHERE sku = '${escapedSku}';\n`;
}

sql += `
COMMIT;

-- Step 4: Verify
SELECT 
  COUNT(*) as total_skus,
  COUNT(expire_in_days) as skus_with_expiry_days,
  AVG(expire_in_days) as avg_expire_days,
  MIN(expire_in_days) as min_expire_days,
  MAX(expire_in_days) as max_expire_days
FROM "Cleaned_FG_Master_file";

-- Show sample with dates
SELECT sku, description, mfd_date, expiry_date, expire_in_days
FROM "Cleaned_FG_Master_file"
WHERE expire_in_days IS NOT NULL
ORDER BY expire_in_days DESC
LIMIT 10;
`;

fs.writeFileSync('UPDATE_EXPIRE_DAYS.sql', sql);

console.log('✅ SQL file generated: UPDATE_EXPIRE_DAYS.sql');
console.log(`📊 Total UPDATE statements: ${finalMap.size}`);
console.log('\n🚀 Next: Update via API or run SQL manually\n');
