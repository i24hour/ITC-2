#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

const BASE_URL = 'https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net';

console.log('🚀 Complete Aging Data Workflow\n');
console.log('='.repeat(60));

async function step1_populateAging() {
  console.log('\n📊 Step 1: Populating aging data from Excel...\n');
  
  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };
    
    const req = https.request(BASE_URL + '/api/admin/populate-aging', options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const result = JSON.parse(data);
          console.log('✅ Aging data populated successfully!');
          console.log(`   Total SKUs: ${result.stats.totalSKUs}`);
          console.log(`   SKUs with aging: ${result.stats.skusWithAging}`);
          console.log(`   SKUs updated: ${result.stats.skusUpdated}`);
          console.log(`   Average aging: ${result.stats.averageAging} days\n`);
          resolve(result);
        } else {
          console.error(`❌ Error: HTTP ${res.statusCode}`);
          console.error(`   Response: ${data}\n`);
          reject(new Error(data));
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('❌ Network error:', err.message);
      reject(err);
    });
    
    req.end();
  });
}

async function step2_downloadCSV() {
  console.log('📥 Step 2: Downloading updated CSV...\n');
  
  return new Promise((resolve, reject) => {
    const filename = 'Cleaned_FG_Master_file_FINAL.csv';
    const file = fs.createWriteStream(filename);
    
    https.get(BASE_URL + '/api/admin/export-table/Cleaned_FG_Master_file', (res) => {
      if (res.statusCode === 200) {
        let downloadedSize = 0;
        const totalSize = parseInt(res.headers['content-length'] || 0);
        
        res.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0) {
            const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
            process.stdout.write(`\r⏳ Downloading: ${percent}%`);
          }
        });
        
        res.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log('\n✅ CSV downloaded successfully!');
          console.log(`   Filename: ${filename}`);
          console.log(`   Size: ${(downloadedSize / 1024).toFixed(2)} KB\n`);
          
          // Verify aging column
          const content = fs.readFileSync(filename, 'utf8');
          const firstLine = content.split('\n')[0];
          
          if (firstLine.includes('aging_days')) {
            console.log('✅ aging_days column is present!');
            
            // Show sample
            const lines = content.split('\n');
            console.log('\n📋 Sample data (first 3 rows):');
            lines.slice(0, 4).forEach((line, i) => {
              console.log(`   ${i}. ${line.substring(0, 80)}`);
            });
          } else {
            console.log('⚠️  aging_days column not found!');
          }
          
          resolve(filename);
        });
      } else {
        console.error(`❌ Download failed: HTTP ${res.statusCode}`);
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    }).on('error', reject);
  });
}

async function main() {
  try {
    // Step 1: Populate aging
    await step1_populateAging();
    
    // Step 2: Download CSV
    await step2_downloadCSV();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL DONE!');
    console.log('='.repeat(60));
    console.log('\n✅ Cleaned_FG_Master_file_FINAL.csv is ready with aging data!\n');
    
  } catch (error) {
    console.error('\n❌ Workflow failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check if Excel file is deployed on Azure');
    console.error('   2. Verify populate-aging.html works in browser');
    console.error('   3. Wait 2-3 minutes for deployment to complete\n');
    process.exit(1);
  }
}

main();
