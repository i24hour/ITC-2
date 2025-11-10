#!/usr/bin/env node

const https = require('https');

console.log('⏳ Waiting for Azure deployment to complete...\n');

let attempt = 0;
const maxAttempts = 20;

function checkDeployment() {
  attempt++;
  console.log(`🔍 Check ${attempt}/${maxAttempts}: Testing API endpoint...`);
  
  https.get('https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/populate-aging.html', (res) => {
    if (res.statusCode === 200) {
      console.log('✅ populate-aging.html is live!');
      console.log('\n' + '='.repeat(60));
      console.log('🎉 DEPLOYMENT COMPLETE!');
      console.log('='.repeat(60));
      console.log('\n📋 Next Steps:');
      console.log('1. Open: https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/populate-aging.html');
      console.log('2. Click "Populate Aging Data" button');
      console.log('3. Wait for completion');
      console.log('4. Run: node download-with-retry.js');
      console.log('\n🚀 Ready to populate aging data!\n');
      process.exit(0);
    } else {
      console.log(`   Status: ${res.statusCode} - Still deploying...`);
      scheduleNext();
    }
  }).on('error', (err) => {
    console.log(`   Error: ${err.message} - Still waiting...`);
    scheduleNext();
  });
}

function scheduleNext() {
  if (attempt < maxAttempts) {
    console.log('   ⏳ Waiting 15 seconds...\n');
    setTimeout(checkDeployment, 15000);
  } else {
    console.log('\n⚠️  Max attempts reached. Deployment might take longer.');
    console.log('💡 Try manually: https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/populate-aging.html\n');
    process.exit(1);
  }
}

checkDeployment();
