const XLSX = require('xlsx');
const db = require('./db');

console.log('🔄 Migrating to New Database Structure\n');
console.log('This will:');
console.log('1. Create Cleaned_FG_Master_file table from Excel');
console.log('2. Create new Inventory table (capitalized)');
console.log('3. Copy data from old inventory table to new Inventory table');
console.log('4. Keep your existing data intact\n');

async function migrate() {
    try {
        // ==================== STEP 1: Create Cleaned_FG_Master_file ====================
        console.log('📋 Step 1: Creating Cleaned_FG_Master_file from Excel...');
        
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
        
        console.log(`   Found ${skuMap.size} SKUs in Excel`);
        
        // Create table
        await db.query('DROP TABLE IF EXISTS "Cleaned_FG_Master_file" CASCADE');
        await db.query(`
            CREATE TABLE "Cleaned_FG_Master_file" (
                sku VARCHAR(50) PRIMARY KEY,
                description TEXT NOT NULL,
                uom DECIMAL(10,3) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Insert SKU data
        for (const { sku, description, uom } of skuMap.values()) {
            await db.query(
                `INSERT INTO "Cleaned_FG_Master_file" (sku, description, uom) VALUES ($1, $2, $3)`,
                [sku, description, uom]
            );
        }
        console.log('   ✅ Cleaned_FG_Master_file created with', skuMap.size, 'SKUs\n');
        
        // ==================== STEP 2: Create new Inventory table ====================
        console.log('📦 Step 2: Creating new Inventory table (capitalized)...');
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS "Inventory" (
                id SERIAL PRIMARY KEY,
                bin_no VARCHAR(10) NOT NULL,
                sku VARCHAR(50) NOT NULL,
                batch_no VARCHAR(20) NOT NULL,
                cfc INTEGER NOT NULL DEFAULT 0,
                description TEXT,
                uom DECIMAL(10,3),
                weight DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(bin_no, sku)
            )
        `);
        console.log('   ✅ Inventory table created\n');
        
        // ==================== STEP 3: Migrate data from old to new ====================
        console.log('🔄 Step 3: Checking for data in old inventory table...');
        
        // Check if old inventory table exists
        const checkOldTable = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'inventory'
            )
        `);
        
        if (checkOldTable.rows[0].exists) {
            console.log('   Found old inventory table, migrating data...');
            
            // Get data from old table
            const oldData = await db.query(`SELECT * FROM inventory`);
            console.log(`   Found ${oldData.rows.length} records in old inventory table`);
            
            if (oldData.rows.length > 0) {
                // Insert into new table
                for (const row of oldData.rows) {
                    try {
                        await db.query(`
                            INSERT INTO "Inventory" (bin_no, sku, batch_no, cfc, description, uom, weight, created_at, updated_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                            ON CONFLICT (bin_no, sku) DO UPDATE SET
                                cfc = EXCLUDED.cfc,
                                batch_no = EXCLUDED.batch_no,
                                description = EXCLUDED.description,
                                uom = EXCLUDED.uom,
                                weight = EXCLUDED.weight,
                                updated_at = EXCLUDED.updated_at
                        `, [
                            row.bin_no,
                            row.sku,
                            row.batch_no || 'Z01JAN25',
                            row.cfc || 0,
                            row.description,
                            row.uom,
                            row.weight,
                            row.created_at || new Date(),
                            row.updated_at || new Date()
                        ]);
                    } catch (err) {
                        console.log(`   Warning: Could not migrate row for bin ${row.bin_no}, SKU ${row.sku}:`, err.message);
                    }
                }
                console.log('   ✅ Data migration complete\n');
            } else {
                console.log('   No data to migrate (old table is empty)\n');
            }
        } else {
            console.log('   No old inventory table found, starting fresh\n');
        }
        
        // ==================== STEP 4: Verify ====================
        console.log('📊 Step 4: Verifying new structure...');
        
        const inventoryCount = await db.query(`SELECT COUNT(*) as count FROM "Inventory"`);
        const skuCount = await db.query(`SELECT COUNT(*) as count FROM "Cleaned_FG_Master_file"`);
        const nonEmptyBins = await db.query(`SELECT COUNT(*) as count FROM "Inventory" WHERE cfc > 0`);
        
        console.log('\n✅ Migration Complete!');
        console.log('='.repeat(50));
        console.log(`📋 Cleaned_FG_Master_file: ${skuCount.rows[0].count} SKUs`);
        console.log(`📦 Inventory table: ${inventoryCount.rows[0].count} total records`);
        console.log(`📦 Non-empty bins: ${nonEmptyBins.rows[0].count} bins with CFC > 0`);
        console.log('='.repeat(50));
        console.log('\n🎉 System will now use NEW structure for all operations!');
        console.log('   - Incoming/Outgoing will log to Incoming/Outgoing tables');
        console.log('   - Reports will fetch from new Inventory table');
        console.log('   - SKU validation will use Cleaned_FG_Master_file\n');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error.stack);
    } finally {
        await db.end();
    }
}

migrate();
