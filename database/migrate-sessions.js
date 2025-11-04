// Migration script to fix user_sessions operator_id column size
const db = require('./db');

async function migrateSessionsTable() {
    try {
        console.log('🔄 Migrating user_sessions table...');
        
        // Check if table exists
        const tableCheck = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'user_sessions'
            );
        `);
        
        if (tableCheck.rows[0].exists) {
            console.log('✅ user_sessions table found');
            
            // Alter the operator_id column to allow longer values
            await db.query(`
                ALTER TABLE user_sessions 
                ALTER COLUMN operator_id TYPE VARCHAR(255);
            `);
            
            console.log('✅ operator_id column updated to VARCHAR(255)');
        } else {
            console.log('⚠️  user_sessions table does not exist yet - will be created on server start');
        }
        
        console.log('✅ Migration completed successfully!\n');
        await db.end();
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Migration error:', error);
        console.error('   If table does not exist, this is normal - it will be created on server start\n');
        process.exit(1);
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateSessionsTable();
}

module.exports = { migrateSessionsTable };
