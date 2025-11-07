const XLSX = require('xlsx');

console.log('📖 Checking Excel file for date columns...\n');

const workbook = XLSX.readFile('BATCHWISE AGE ANALYSIS REPORT.XLS');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Show header row
console.log('📋 Header Row (Row 7-8):');
console.log('Row 7:', data[6]);
console.log('Row 8:', data[7]);
console.log('\n📊 Sample data (first row after header):');
console.log('Row 9:', data[8]);

// Show all columns
console.log('\n📑 All Column Indexes:');
const headers = data[7] || data[6] || [];
headers.forEach((header, index) => {
  if (header) {
    console.log(`   Column ${String.fromCharCode(65 + index)} (${index}): ${header}`);
  }
});
