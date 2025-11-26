const https = require('https');

const newSKUs = [
  'FXC10020SA',
  'FXC170020S',
  'FXC17005S',
  'FXC20050S',
  'FXC30050S',
  'FXC60005S',
  'FXC73010S',
  'FXC73030SA',
  'FXC74050S',
  'FXC75010SA',
  'FXC75020SA',
  'FXCM'
];

console.log(`📤 Uploading ${newSKUs.length} new SKUs to Azure...`);

const postData = JSON.stringify({ newSKUs: newSKUs });

const options = {
  hostname: 'itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net',
  path: '/api/admin/add-new-skus',
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
      console.log('\n✅ SUCCESS!');
      console.log('================================================================================');
      console.log(`New SKUs Added: ${result.summary.addedSKUs}`);
      console.log(`Total SKUs in Master File: ${result.summary.totalSKUs}`);
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
