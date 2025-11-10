const XLSX = require('xlsx');

console.log('\n📊 EXCEL FILE ANALYSIS\n');
console.log('='.repeat(60));

try {
  const workbook = XLSX.readFile('./BATCHWISE AGE ANALYSIS REPORT.XLS');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log(`📄 Sheet Name: ${sheetName}`);
  console.log(`📋 Total Rows: ${data.length}`);
  console.log('='.repeat(60));
  
  // Find header row
  let headerRow = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][3] === 'Brand code' || data[i][3] === 'SKU') {
      headerRow = i;
      break;
    }
  }
  
  console.log(`\n📌 Header Row Found: Row ${headerRow + 1}`);
  console.log(`   Column D: "${data[headerRow][3]}"`);
  console.log(`   Column R: "${data[headerRow][17]}"`);
  
  // Collect and analyze data
  const agingData = new Map();
  let totalRows = 0;
  
  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i];
    const sku = row[3]?.toString().trim();
    const aging = parseInt(row[17]);
    
    if (sku && !isNaN(aging)) {
      if (!agingData.has(sku)) {
        agingData.set(sku, []);
      }
      agingData.get(sku).push(aging);
      totalRows++;
    }
  }
  
  console.log('\n📊 DATA ANALYSIS');
  console.log('='.repeat(60));
  console.log(`   Total Data Rows: ${totalRows}`);
  console.log(`   Unique SKUs: ${agingData.size}`);
  
  // Calculate statistics
  let minAging = Infinity;
  let maxAging = -Infinity;
  let totalAging = 0;
  let agingCount = 0;
  
  for (const [sku, agingValues] of agingData) {
    for (const aging of agingValues) {
      minAging = Math.min(minAging, aging);
      maxAging = Math.max(maxAging, aging);
      totalAging += aging;
      agingCount++;
    }
  }
  
  const avgAging = Math.round(totalAging / agingCount);
  
  console.log(`   Min Aging: ${minAging} days`);
  console.log(`   Max Aging: ${maxAging} days`);
  console.log(`   Avg Aging: ${avgAging} days`);
  
  // Show SKUs with multiple entries
  const multipleEntries = [];
  for (const [sku, agingValues] of agingData) {
    if (agingValues.length > 1) {
      multipleEntries.push({ sku, count: agingValues.length, values: agingValues });
    }
  }
  
  console.log(`   SKUs with Multiple Entries: ${multipleEntries.length}`);
  
  // Display sample data
  console.log('\n📋 SAMPLE DATA (First 15 SKUs)');
  console.log('='.repeat(60));
  let count = 0;
  for (const [sku, agingValues] of agingData) {
    if (count++ < 15) {
      const avgSkuAging = Math.round(agingValues.reduce((a, b) => a + b, 0) / agingValues.length);
      const suffix = agingValues.length > 1 ? ` (${agingValues.length} entries: ${agingValues.join(', ')})` : '';
      console.log(`   ${count}. ${sku.padEnd(20)} → ${avgSkuAging} days${suffix}`);
    }
  }
  
  // Show SKUs with multiple entries
  if (multipleEntries.length > 0) {
    console.log('\n⚠️  SKUs WITH MULTIPLE AGING VALUES (First 5)');
    console.log('='.repeat(60));
    multipleEntries.slice(0, 5).forEach((item, i) => {
      const avg = Math.round(item.values.reduce((a, b) => a + b, 0) / item.values.length);
      console.log(`   ${i + 1}. ${item.sku.padEnd(20)} → Values: [${item.values.join(', ')}], Avg: ${avg}`);
    });
    console.log(`   Note: Average will be used for ${multipleEntries.length} SKUs`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Analysis Complete!\n');
  
  // Generate preview of SQL statements
  console.log('📝 SAMPLE SQL STATEMENTS (First 10)');
  console.log('='.repeat(60));
  count = 0;
  for (const [sku, agingValues] of agingData) {
    if (count++ < 10) {
      const avgAging = Math.round(agingValues.reduce((a, b) => a + b, 0) / agingValues.length);
      const escapedSku = sku.replace(/'/g, "''");
      console.log(`UPDATE "Cleaned_FG_Master_file" SET aging_days = ${avgAging} WHERE sku = '${escapedSku}';`);
    }
  }
  console.log('...\n');
  
  console.log('💡 NEXT STEPS:');
  console.log('   1. Run: node database/generate-aging-sql.js');
  console.log('   2. Execute generated SQL file in Azure Portal');
  console.log('   3. Or run: node database/add-aging-column.js (if DB connection works)\n');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
