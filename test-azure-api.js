// Test the live Azure API endpoint to see what it returns
const https = require('https');

const hostname = 'itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net';
const path = '/api/sku-list';

console.log(`🔍 Testing Azure endpoint: https://${hostname}${path}\n`);

const options = {
  hostname: hostname,
  path: path,
  method: 'GET',
  headers: {
    'User-Agent': 'Node.js Test Script'
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`📡 Response Status: ${res.statusCode}`);
    console.log(`📏 Response Length: ${data.length} bytes\n`);
    
    if (data.length === 0) {
      console.log('⚠️ Empty response received from server');
      console.log('This might mean Azure is restarting or deploying');
      return;
    }
    
    try {
      const result = JSON.parse(data);
      
      if (result.skus) {
        console.log(`📊 Total SKUs returned: ${result.skus.length}`);
        console.log('\n📋 SKU List:');
        result.skus.forEach((sku, index) => {
          console.log(`  ${index + 1}. ${sku}`);
        });
        
        console.log('\n' + '='.repeat(60));
        if (result.skus.length === 4 || result.skus.length === 5) {
          console.log('✅ CORRECT: Azure is returning filtered SKU list!');
        } else if (result.skus.length > 10) {
          console.log('❌ WRONG: Azure is still returning ALL SKUs (old code)');
          console.log('⏳ Deployment still in progress. Wait 1-2 more minutes.');
        }
      } else {
        console.log('Response:', result);
      }
    } catch (e) {
      console.error('❌ Error parsing response:', e.message);
      console.log('Raw Response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
});

req.end();
