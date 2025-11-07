const https = require('https');
const fs = require('fs');

console.log('📥 Downloading Cleaned_FG_Master_file with aging data...\n');

const url = 'https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/api/admin/export-table/Cleaned_FG_Master_file';
const filename = 'Cleaned_FG_Master_file_with_aging.csv';

https.get(url, (response) => {
  if (response.statusCode === 200) {
    const file = fs.createWriteStream(filename);
    
    let downloadedSize = 0;
    const totalSize = parseInt(response.headers['content-length'] || 0);
    
    response.on('data', (chunk) => {
      downloadedSize += chunk.length;
      if (totalSize > 0) {
        const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
        process.stdout.write(`\r⏳ Downloading... ${percent}%`);
      }
    });
    
    response.pipe(file);
    
    file.on('finish', () => {
      file.close();
      console.log('\n\n✅ Download Complete!');
      console.log('='.repeat(60));
      console.log(`📄 File: ${filename}`);
      console.log(`💾 Size: ${(downloadedSize / 1024).toFixed(2)} KB`);
      console.log(`📂 Location: ${process.cwd()}/${filename}`);
      console.log('='.repeat(60));
      
      // Show first few lines
      const fileContent = fs.readFileSync(filename, 'utf8');
      const lines = fileContent.split('\n').slice(0, 5);
      console.log('\n📋 First 5 lines:');
      lines.forEach((line, i) => {
        console.log(`   ${i + 1}. ${line.substring(0, 80)}${line.length > 80 ? '...' : ''}`);
      });
      console.log('\n✅ Check the file - aging_days column should be there!\n');
    });
    
  } else if (response.statusCode === 302 || response.statusCode === 301) {
    console.log('🔄 Following redirect...');
    https.get(response.headers.location, (res) => {
      // Handle redirected response
      const file = fs.createWriteStream(filename);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('✅ Download complete!');
      });
    });
  } else {
    console.error(`❌ Error: HTTP ${response.statusCode}`);
    console.error('💡 The server might still be deploying. Wait 2-3 minutes and try again.');
  }
}).on('error', (err) => {
  console.error('❌ Download failed:', err.message);
  console.error('\n💡 Possible solutions:');
  console.error('   1. Check if Azure deployment is complete');
  console.error('   2. Try again in a few minutes');
  console.error('   3. Check internet connection\n');
});
