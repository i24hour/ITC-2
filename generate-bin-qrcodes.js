// Generate QR codes for all bins in inventory
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'itc_warehouse',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('azure') 
        ? { rejectUnauthorized: false } 
        : false
});

// Create BIN directory if it doesn't exist
const binDir = path.join(__dirname, 'BIN');
if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
    console.log('✅ Created BIN directory');
}

async function generateBinQRCodes() {
    try {
        console.log('🔍 Fetching all bins from database...\n');
        
        // Get all unique bin numbers
        const result = await pool.query(`
            SELECT DISTINCT bin_no 
            FROM inventory 
            WHERE bin_no IS NOT NULL 
            ORDER BY bin_no
        `);
        
        const bins = result.rows;
        console.log(`📦 Found ${bins.length} bins\n`);
        
        let generated = 0;
        let skipped = 0;
        
        for (const row of bins) {
            const binNo = row.bin_no;
            const filename = path.join(binDir, `${binNo}.png`);
            
            // Check if QR code already exists
            if (fs.existsSync(filename)) {
                console.log(`⏭️  Skipped ${binNo} (already exists)`);
                skipped++;
                continue;
            }
            
            // Generate QR code
            await QRCode.toFile(filename, binNo, {
                type: 'png',
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            
            console.log(`✅ Generated QR code for bin: ${binNo}`);
            generated++;
        }
        
        console.log(`\n✨ QR Code Generation Complete!`);
        console.log(`   Generated: ${generated} new QR codes`);
        console.log(`   Skipped: ${skipped} existing QR codes`);
        console.log(`   Total: ${bins.length} bins`);
        console.log(`\n📁 QR codes saved in: ${binDir}`);
        
        await pool.end();
    } catch (error) {
        console.error('❌ Error generating QR codes:', error);
        process.exit(1);
    }
}

// Run the generator
generateBinQRCodes();
