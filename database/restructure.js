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
        
        // ==================== TABLE 1: Cleaned_FG_Master_file ====================
        console.log('\n📋 Creating Cleaned_FG_Master_file...');
        await db.query('DROP TABLE IF EXISTS "Cleaned_FG_Master_file" CASCADE');
        await db.query(`
            CREATE TABLE "Cleaned_FG_Master_file" (
                sku VARCHAR(50) PRIMARY KEY,
                description TEXT NOT NULL,
                uom DECIMAL(10,3) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        for (const [_, d] of skuMap) {
            await db.query('INSERT INTO "Cleaned_FG_Master_file" (sku, description, uom) VALUES ($1, $2, $3)', 
                [d.sku, d.description, d.uom]);
        }
        console.log(`✅ Cleaned_FG_Master_file created with ${skuMap.size} SKUs`);
        
        // ==================== TABLE 5: Bins ====================
        console.log('\n🗃️ Creating Bins table...');
        await db.query('DROP TABLE IF EXISTS "Bins" CASCADE');
        await db.query(`
            CREATE TABLE "Bins" (
                bin_no VARCHAR(50) PRIMARY KEY,
                category CHAR(1) NOT NULL,
                status VARCHAR(20) DEFAULT 'empty',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        const bins = generateBins();
        for (const bin of bins) {
            await db.query('INSERT INTO "Bins" (bin_no, category) VALUES ($1, $2)', [bin, bin.charAt(0)]);
        }
        console.log(`✅ Bins table created with ${bins.length} bins`);
        
        // ==================== TABLE 2: Inventory ====================
        console.log('\n📦 Creating Inventory table...');
        await db.query('DROP TABLE IF EXISTS "Inventory" CASCADE');
        await db.query(`
            CREATE TABLE "Inventory" (
                id SERIAL PRIMARY KEY,
                bin_no VARCHAR(50) NOT NULL,
                sku VARCHAR(50) NOT NULL,
                batch_no VARCHAR(100) NOT NULL,
                cfc INTEGER DEFAULT 0,
                description TEXT NOT NULL,
                uom DECIMAL(10,3) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sku) REFERENCES "Cleaned_FG_Master_file"(sku),
                FOREIGN KEY (bin_no) REFERENCES "Bins"(bin_no)
            )
        `);
        console.log('✅ Inventory table created (empty - CFC = 0 for all)');
        
        // ==================== TABLE 3: Incoming ====================
        console.log('\n📥 Creating Incoming table...');
        await db.query('DROP TABLE IF EXISTS "Incoming" CASCADE');
        await db.query(`
            CREATE TABLE "Incoming" (
                id SERIAL PRIMARY KEY,
                sku VARCHAR(50) NOT NULL,
                batch_no VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                weight DECIMAL(10,2) NOT NULL,
                uom DECIMAL(10,3) NOT NULL,
                cfc INTEGER NOT NULL,
                bin_no VARCHAR(50),
                incoming_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sku) REFERENCES "Cleaned_FG_Master_file"(sku),
                FOREIGN KEY (bin_no) REFERENCES "Bins"(bin_no)
            )
        `);
        console.log('✅ Incoming table created');
        
        // ==================== TABLE 4: Outgoing ====================
        console.log('\n📤 Creating Outgoing table...');
        await db.query('DROP TABLE IF EXISTS "Outgoing" CASCADE');
        await db.query(`
            CREATE TABLE "Outgoing" (
                id SERIAL PRIMARY KEY,
                sku VARCHAR(50) NOT NULL,
                batch_no VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                weight DECIMAL(10,2) NOT NULL,
                uom DECIMAL(10,3) NOT NULL,
                cfc INTEGER NOT NULL,
                bin_no VARCHAR(50),
                dod TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sku) REFERENCES "Cleaned_FG_Master_file"(sku),
                FOREIGN KEY (bin_no) REFERENCES "Bins"(bin_no)
            )
        `);
        console.log('✅ Outgoing table created');
        
        // ==================== SUMMARY ====================
        console.log('\n' + '='.repeat(60));
        console.log('✅ DATABASE RESTRUCTURE COMPLETE!');
        console.log('='.repeat(60));
        console.log(`📋 Table 1: Cleaned_FG_Master_file - ${skuMap.size} SKUs`);
        console.log(`📦 Table 2: Inventory - 0 records (all bins empty)`);
        console.log(`📥 Table 3: Incoming - 0 records (ready for transactions)`);
        console.log(`📤 Table 4: Outgoing - 0 records (ready for transactions)`);
        console.log(`🗃️ Table 5: Bins - ${bins.length} bins (A-P categories)`);
        console.log('='.repeat(60));
        console.log('\n✅ All 5 tables created successfully!');
        console.log('🚀 You can now use the Incoming tab to add inventory.\n');
        
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
