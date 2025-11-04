// Migration Script: Assign Operator IDs to Existing Users
const db = require('./db');

async function migrateExistingUsers() {
    const client = await db.getClient();
    
    try {
        console.log('\n🔄 Starting migration: Assign Operator IDs to existing users\n');
        
        await client.query('BEGIN');
        
        // 1. Check if Operators table exists
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'Operators'
            )
        `);
        
        if (!tableCheck.rows[0].exists) {
            console.log('❌ Operators table does not exist. Please run restructure first.');
            await client.query('ROLLBACK');
            return;
        }
        
        // 2. Get all unique users from user_sessions (excluding those with operator_id)
        const existingUsers = await client.query(`
            SELECT DISTINCT user_identifier, user_name
            FROM user_sessions
            WHERE operator_id IS NULL OR operator_id = ''
            ORDER BY user_identifier
        `);
        
        console.log(`📋 Found ${existingUsers.rows.length} existing users without operator IDs\n`);
        
        if (existingUsers.rows.length === 0) {
            console.log('✅ All users already have operator IDs. No migration needed.');
            await client.query('ROLLBACK');
            return;
        }
        
        // 3. Get current operator count
        const countResult = await client.query(`SELECT COUNT(*) as count FROM "Operators"`);
        let nextNumber = parseInt(countResult.rows[0].count) + 1;
        
        console.log(`Starting operator ID assignment from OP${String(nextNumber).padStart(3, '0')}\n`);
        
        // 4. Create operators for each unique user
        const operatorMap = new Map(); // email -> operator_id
        
        for (const user of existingUsers.rows) {
            const email = user.user_identifier;
            const name = user.user_name || email;
            
            // Check if operator already exists in Operators table
            const existingOp = await client.query(
                `SELECT operator_id FROM "Operators" WHERE email = $1`,
                [email]
            );
            
            let operatorId;
            
            if (existingOp.rows.length > 0) {
                // Operator already exists
                operatorId = existingOp.rows[0].operator_id;
                console.log(`   ℹ️  ${email} -> ${operatorId} (already exists)`);
            } else {
                // Create new operator
                operatorId = `OP${String(nextNumber).padStart(3, '0')}`;
                
                await client.query(
                    `INSERT INTO "Operators" (operator_id, name, email, role, created_at)
                     VALUES ($1, $2, $3, 'operator', CURRENT_TIMESTAMP)`,
                    [operatorId, name, email]
                );
                
                console.log(`   ✅ ${email} -> ${operatorId} (created)`);
                nextNumber++;
            }
            
            operatorMap.set(email, operatorId);
        }
        
        console.log(`\n📝 Updating user_sessions with operator IDs...\n`);
        
        // 5. Update all user_sessions with the new operator IDs
        for (const [email, operatorId] of operatorMap.entries()) {
            const updateResult = await client.query(
                `UPDATE user_sessions 
                 SET operator_id = $1 
                 WHERE user_identifier = $2 AND (operator_id IS NULL OR operator_id = '')`,
                [operatorId, email]
            );
            
            console.log(`   ✅ Updated ${updateResult.rowCount} sessions for ${email} -> ${operatorId}`);
        }
        
        await client.query('COMMIT');
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ MIGRATION COMPLETE!');
        console.log('='.repeat(60));
        console.log(`📊 Summary:`);
        console.log(`   - Operators created: ${operatorMap.size}`);
        console.log(`   - Sessions updated: ${existingUsers.rows.length}`);
        console.log(`   - Next operator ID: OP${String(nextNumber).padStart(3, '0')}`);
        console.log('='.repeat(60) + '\n');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration error:', error);
        throw error;
    } finally {
        client.release();
        await db.end();
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateExistingUsers()
        .then(() => {
            console.log('✅ Migration script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateExistingUsers };
