const XLSX = require('xlsx');
const db = require('./db');

console.log('🚀 Database Restructure Script for Azure Deployment\n');

// Generate all bins
function generateBins() {
    const bins = [];
    for (let i = 1; i <= 8; i++) bins.push(`A${String(i).padStart(2, '0')}`);
    ['B', 'C'].forEach(l => { for (let i = 1; i <= 7; i++) bins.push(`${l}${String(i).padStart(2, '0')}`); });
    for (let l = 'D'.charCodeAt(0); l <= 'O'.charCodeAt(0); l++) {
        for (let i = 1; i <= 8; i++) bins.push(`${String.fromCharCode(l)}${String(i).padStart(2, '0')}`);
    }
    for (let i = 1; i <= 11; i++) bins.push(`P${String(i).padStart(2, '0')}`);
    return bins;
}

async function restructure() {
    try {
        console.log('Starting restructure...');
        
        // Read SKU data from Excel
        const workbook = XLSX.readFile('./BINGO STOCK  16.10.2025.xlsx');
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const headerIdx = data.findIndex(r => JSON.stringify(r).toUpperCase().includes('SKU'));
        const skuMap = new Map();
        
        for (let i = headerIdx + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || !row[1]) continue;
            const sku = row[1].toString().trim();
            const desc = row[3]?.toString().trim();
            const uom = parseFloat(row[5]) || 0;
            if (sku && desc && uom > 0 && !skuMap.has(sku)) {
                skuMap.set(sku, { sku, description: desc, uom });
            }
        }
        
        console.log(`Found ${skuMap.size} SKUs`);
        
        // Create tables
        await db.query('DROP TABLE IF EXISTS sku_master CASCADE');
        await db.query(`
            CREATE TABLE sku_master (
                sku VARCHAR(50) PRIMARY KEY,
                description TEXT NOT NULL,
                uom DECIMAL(10,3) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        for (const [_, d] of skuMap) {
            await db.query('INSERT INTO sku_master (sku, description, uom) VALUES ($1, $2, $3)', 
                [d.sku, d.description, d.uom]);
        }
        
        await db.query('DROP TABLE IF EXISTS bins CASCADE');
        await db.query(`
            CREATE TABLE bins (
                bin_no VARCHAR(50) PRIMARY KEY,
                category CHAR(1) NOT NULL,
                status VARCHAR(20) DEFAULT 'empty'
            )
        `);
        
        const bins = generateBins();
        for (const bin of bins) {
            await db.query('INSERT INTO bins (bin_no, category) VALUES ($1, $2)', [bin, bin.charAt(0)]);
        }
        
        await db.query('DROP TABLE IF EXISTS inventory CASCADE');
        await db.query(`
            CREATE TABLE inventory (
                id SERIAL PRIMARY KEY,
                bin_no VARCHAR(50) NOT NULL,
                sku VARCHAR(50) NOT NULL,
                batch_no VARCHAR(100),
                cfc INTEGER DEFAULT 0,
                qty DECIMAL(10,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sku) REFERENCES sku_master(sku),
                FOREIGN KEY (bin_no) REFERENCES bins(bin_no),
                UNIQUE(bin_no, sku, batch_no)
            )
        `);
        
        await db.query('DROP TABLE IF EXISTS active_skus CASCADE');
        await db.query(`
            CREATE TABLE active_skus (
                sku VARCHAR(50) PRIMARY KEY,
                is_active BOOLEAN DEFAULT true,
                FOREIGN KEY (sku) REFERENCES sku_master(sku)
            )
        `);
        
        for (const [sku] of skuMap) {
            await db.query('INSERT INTO active_skus (sku, is_active) VALUES ($1, true)', [sku]);
        }
        
        console.log(`✅ Restructure complete: ${bins.length} bins, ${skuMap.size} SKUs`);
        await db.end();
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Only run if called directly
if (require.main === module) {
    restructure();
}

module.exports = { restructure, generateBins };
