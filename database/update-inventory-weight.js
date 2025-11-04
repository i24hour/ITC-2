const db = require('./db');

async function updateInventoryStructure() {
    try {
        console.log('\n🔧 Updating Inventory table structure...\n');
        
        const client = await db.getClient();
        
        // 1. Add weight column to Inventory table if it doesn't exist
        console.log('📦 Adding weight column to Inventory table...');
        await client.query(`
            ALTER TABLE "Inventory" 
            ADD COLUMN IF NOT EXISTS weight DECIMAL(10,2)
        `);
        console.log('✅ Weight column added to Inventory table');
        
        // 2. Drop unused Bin_Inventory table
        console.log('\n🗑️ Dropping unused Bin_Inventory table...');
        try {
            await client.query('DROP TABLE IF EXISTS "Bin_Inventory" CASCADE');
            console.log('✅ Bin_Inventory table dropped');
        } catch (err) {
            console.log('⚠️ Bin_Inventory table does not exist or already dropped');
        }
        
        client.release();
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ INVENTORY STRUCTURE UPDATE COMPLETE!');
        console.log('='.repeat(60));
        console.log('✅ Inventory table now has weight column');
        console.log('✅ Unused Bin_Inventory table removed');
        console.log('='.repeat(60) + '\n');
        
        await db.end();
        
    } catch (error) {
        console.error('❌ Error updating inventory structure:', error);
        process.exit(1);
    }
}

// Only run if called directly
if (require.main === module) {
    updateInventoryStructure();
}

module.exports = { updateInventoryStructure };
