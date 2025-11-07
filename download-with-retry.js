#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

const url = 'https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/api/admin/export-table/Cleaned_FG_Master_file';
const filename = 'Cleaned_FG_Master_file_with_aging.csv';
const maxRetries = 5;
let retryCount = 0;

console.log('🚀 Starting download process...\n');

function downloadFile() {
  console.log(`📥 Attempt ${retryCount + 1}/${maxRetries}: Downloading from Azure...`);
  
  https.get(url, (response) => {
    if (response.statusCode === 200) {
      console.log('✅ Connected! Downloading...\n');
      
      const file = fs.createWriteStream(filename);
      let downloadedSize = 0;
      const totalSize = parseInt(response.headers['content-length'] || 0);
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize > 0) {
          const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
          process.stdout.write(`\r⏳ Progress: ${percent}% (${(downloadedSize / 1024).toFixed(1)} KB)`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('\n\n' + '='.repeat(60));
        console.log('✅ DOWNLOAD SUCCESSFUL!');
        console.log('='.repeat(60));
        console.log(`📄 Filename: ${filename}`);
        console.log(`💾 Size: ${(downloadedSize / 1024).toFixed(2)} KB`);
        console.log(`📂 Location: ${process.cwd()}/${filename}`);
        console.log('='.repeat(60));
        
        // Show preview
        try {
          const content = fs.readFileSync(filename, 'utf8');
          const lines = content.split('\n');
          
          console.log('\n📊 File Preview (First 5 rows):');
          console.log('-'.repeat(60));
          lines.slice(0, 5).forEach((line, i) => {
            if (line.trim()) {
              console.log(`${i}. ${line.substring(0, 80)}${line.length > 80 ? '...' : ''}`);
            }
          });
          console.log('-'.repeat(60));
          console.log(`\n📈 Total rows: ${lines.length - 1} (excluding header)`);
          
          // Check for aging_days column
          const header = lines[0];
          if (header.includes('aging_days')) {
            console.log('✅ aging_days column is present!');
          } else {
            console.log('⚠️  aging_days column not found - might not be populated yet');
          }
          
          console.log('\n✅ All done! Check the CSV file.\n');
        } catch (err) {
          console.log('\n✅ File downloaded but preview failed:', err.message);
        }
      });
      
      file.on('error', (err) => {
        fs.unlink(filename, () => {});
        console.error('\n❌ File write error:', err.message);
        retryDownload();
      });
      
    } else {
      console.log(`⚠️  HTTP ${response.statusCode}: ${response.statusMessage}`);
      
      if (retryCount < maxRetries - 1) {
        retryDownload();
      } else {
        console.error('\n❌ Max retries reached. Possible issues:');
        console.error('   1. Azure deployment still in progress (wait 2-3 minutes)');
        console.error('   2. Check if populate-aging.html was opened and button clicked');
        console.error('   3. Try manually: https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/download-csv.html\n');
      }
    }
  }).on('error', (err) => {
    console.error(`❌ Network error: ${err.message}`);
    retryDownload();
  });
}

function retryDownload() {
  retryCount++;
  if (retryCount < maxRetries) {
    const waitTime = Math.min(retryCount * 5, 15);
    console.log(`\n⏳ Retrying in ${waitTime} seconds...\n`);
    setTimeout(downloadFile, waitTime * 1000);
  }
}

// Start download
downloadFile();
