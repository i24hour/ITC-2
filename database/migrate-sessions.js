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
            
            // Check current column type
            const columnCheck = await db.query(`
                SELECT data_type, character_maximum_length 
                FROM information_schema.columns 
                WHERE table_name = 'user_sessions' 
                AND column_name = 'operator_id';
            `);
            
            if (columnCheck.rows.length > 0) {
                const currentLength = columnCheck.rows[0].character_maximum_length;
                console.log(`Current operator_id length: ${currentLength}`);
                
                if (currentLength < 255) {
                    // Alter the operator_id column to allow longer values
                    await db.query(`
                        ALTER TABLE user_sessions 
                        ALTER COLUMN operator_id TYPE VARCHAR(255);
                    `);
                    console.log('✅ operator_id column updated to VARCHAR(255)');
                } else {
                    console.log('✅ operator_id column already VARCHAR(255)');
                }
            }
        } else {
            console.log('⚠️  user_sessions table does not exist yet - will be created on initialization');
        }
        
        console.log('✅ Migration completed successfully!\n');
        
    } catch (error) {
        console.error('❌ Migration error:', error.message);
        console.log('⚠️  Continuing anyway - table may not exist yet\n');
        // Don't throw - allow server to continue
    }
}

// Run migration if called directly
if (require.main === module) {
    (async () => {
        await migrateSessionsTable();
        await db.end();
        process.exit(0);
    })();
}

module.exports = { migrateSessionsTable };
