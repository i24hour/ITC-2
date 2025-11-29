const db = require('./database/db');

async function emptyAllTables() {
    const client = await db.getClient();
    try {
        console.log('🗑️  Starting complete database cleanup...\n');
        
        const tables = ['Inventory', 'Incoming', 'Outgoing', 'Task_History'];
        const results = {};
        
        for (const table of tables) {
            try {
                // Count before deletion
                const countBefore = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
                const before = parseInt(countBefore.rows[0].count);
                
                // Delete all records
                const deleteResult = await client.query(`DELETE FROM "${table}"`);
                
                // Verify deletion
                const countAfter = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
                const after = parseInt(countAfter.rows[0].count);
                
                results[table] = {
                    before,
                    deleted: deleteResult.rowCount,
                    after
                };
                
                console.log(`✅ ${table}: Deleted ${deleteResult.rowCount} records (${before} → ${after})`);
                
            } catch (err) {
                console.error(`❌ Error with ${table}:`, err.message);
                results[table] = { error: err.message };
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ DATABASE CLEANUP COMPLETE!');
        console.log('='.repeat(60));
        console.log('\nSummary:');
        for (const [table, result] of Object.entries(results)) {
            if (result.error) {
                console.log(`  ${table}: ERROR - ${result.error}`);
            } else {
                console.log(`  ${table}: ${result.deleted} records deleted`);
            }
        }
        console.log('\n✅ All transaction and inventory data cleared!');
        console.log('📋 Preserved: Bins, Cleaned_FG_Master_file, Operators, Supervisors\n');
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await db.end();
    }
}

emptyAllTables();
