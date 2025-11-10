const XLSX = require('xlsx');

const workbook = XLSX.readFile('BATCHWISE AGE ANALYSIS REPORT.XLS');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('First 10 rows with batch data:');
for (let i = 8; i < Math.min(18, data.length); i++) {
  const row = data[i];
  const sku = row[3]?.toString().trim();
  const batchNo = row[6]?.toString().trim();
  console.log(`Row ${i}: SKU=${sku}, Batch=${batchNo}`);
}

// Count total
const skuBatchMap = new Map();
for (let i = 8; i < data.length; i++) {
  const row = data[i];
  const sku = row[3]?.toString().trim();
  const batchNo = row[6]?.toString().trim();
  
  if (sku && batchNo) {
    if (!skuBatchMap.has(sku)) {
      skuBatchMap.set(sku, []);
    }
    if (!skuBatchMap.get(sku).includes(batchNo)) {
      skuBatchMap.get(sku).push(batchNo);
    }
  }
}

console.log(`\nTotal unique SKUs with batch: ${skuBatchMap.size}`);
console.log('Sample SKUs with batches:');
let count = 0;
for (const [sku, batches] of skuBatchMap) {
  console.log(`  ${sku}: ${batches.join(',')}`);
  if (++count >= 5) break;
}
