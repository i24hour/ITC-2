const db = require('./database/db');

async function emptyInventory() {
    const client = await db.getClient();
    try {
        console.log('🗑️  Starting inventory cleanup...\n');
        
        // Count records before deletion
        const countBefore = await client.query('SELECT COUNT(*) as count FROM "Inventory"');
        console.log(`📊 Current inventory records: ${countBefore.rows[0].count}`);
        
        // Delete all records from Inventory table
        const result = await client.query('DELETE FROM "Inventory"');
        console.log(`✅ Deleted ${result.rowCount} records from Inventory table`);
        
        // Verify deletion
        const countAfter = await client.query('SELECT COUNT(*) as count FROM "Inventory"');
        console.log(`📊 Remaining inventory records: ${countAfter.rows[0].count}`);
        
        console.log('\n✅ Inventory table is now empty!');
        
    } catch (error) {
        console.error('❌ Error emptying inventory:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await db.end();
    }
}

emptyInventory();
