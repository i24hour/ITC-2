const fs = require('fs');
const https = require('https');

async function uploadBingoInventory() {
  try {
    console.log('📥 Reading BINGO STOCK file...');
    
    // Read the CSV file
    const csvData = fs.readFileSync('BINGO STOCK  26.11.2025.xlsx - STOCK SHEET.csv', 'utf-8');
    
    console.log('📤 Uploading to Azure API...');
    
    const postData = JSON.stringify({ csvData: csvData });
    
    const options = {
      hostname: 'itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net',
      path: '/api/admin/upload-bingo-inventory',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          const result = JSON.parse(data);
          console.log('\n✅ INVENTORY UPDATE SUCCESSFUL!');
          console.log('================================================================================');
          console.log(`Total Records: ${result.summary.totalRecords}`);
          console.log(`Unique Bins: ${result.summary.uniqueBins}`);
          console.log(`Unique SKUs: ${result.summary.uniqueSkus}`);
          console.log(`Inserted: ${result.summary.insertedCount} records`);
          console.log('================================================================================\n');
        } else {
          console.error(`❌ Error: HTTP ${res.statusCode}`);
          console.error(data);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
    });
    
    req.write(postData);
    req.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

uploadBingoInventory();
