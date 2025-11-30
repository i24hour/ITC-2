const db = require('./db');

async function createBinHoldsTable() {
    try {
        console.log('🔧 Creating Bin_Holds table...\n');
        
        // Create Bin_Holds table for temporary space reservations
        await db.query(`
            CREATE TABLE IF NOT EXISTS "Bin_Holds" (
                hold_id SERIAL PRIMARY KEY,
                bin_no VARCHAR(50) NOT NULL,
                sku VARCHAR(50) NOT NULL,
                cfc_held INTEGER NOT NULL,
                operator_id VARCHAR(10) NOT NULL,
                task_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                status VARCHAR(20) DEFAULT 'active',
                FOREIGN KEY (bin_no) REFERENCES "Bins"(bin_no),
                FOREIGN KEY (operator_id) REFERENCES "Operators"(operator_id)
            )
        `);
        
        console.log('✅ Bin_Holds table created successfully!\n');
        
        // Add indexes for performance
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_bin_holds_status 
            ON "Bin_Holds"(status, expires_at)
        `);
        
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_bin_holds_task 
            ON "Bin_Holds"(task_id)
        `);
        
        console.log('✅ Indexes created!\n');
        
        // Update Bins table to track capacity
        console.log('🔧 Updating Bins table structure...\n');
        
        await db.query(`
            ALTER TABLE "Bins" 
            ADD COLUMN IF NOT EXISTS cfc_capacity INTEGER DEFAULT 240,
            ADD COLUMN IF NOT EXISTS cfc_held INTEGER DEFAULT 0
        `);
        
        console.log('✅ Bins table updated with capacity tracking!\n');
        
        // Update Pending_Tasks table
        console.log('🔧 Updating Pending_Tasks table...\n');
        
        await db.query(`
            ALTER TABLE "Pending_Tasks"
            ADD COLUMN IF NOT EXISTS bins_held JSONB,
            ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
        `);
        
        console.log('✅ Pending_Tasks table updated!\n');
        
        // Update Task_History for status tracking
        console.log('🔧 Updating Task_History table...\n');
        
        await db.query(`
            ALTER TABLE "Task_History"
            ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS duration_seconds INTEGER
        `);
        
        // Rename completed_at if it doesn't exist, or ensure it exists
        await db.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'Task_History' AND column_name = 'completed_at'
                ) THEN
                    ALTER TABLE "Task_History" ADD COLUMN completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END $$;
        `);
        
        console.log('✅ Task_History table updated!\n');
        
        console.log('='.repeat(60));
        console.log('✅ ALL DATABASE CHANGES COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log('\nNew Tables/Columns:');
        console.log('  ✓ Bin_Holds table (for space reservations)');
        console.log('  ✓ Bins.cfc_capacity, cfc_held');
        console.log('  ✓ Pending_Tasks.bins_held, expires_at, status');
        console.log('  ✓ Task_History.started_at, duration_seconds\n');
        
    } catch (error) {
        console.error('❌ Error creating tables:', error);
        throw error;
    } finally {
        await db.end();
    }
}

// Run if called directly
if (require.main === module) {
    createBinHoldsTable();
}

module.exports = { createBinHoldsTable };
