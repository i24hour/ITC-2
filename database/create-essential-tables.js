const db = require('./db');

// Simple restructure that creates only the essential tables without Excel dependency
async function createEssentialTables() {
    try {
        console.log('\n🔧 Creating essential tables (Operators, Task_History)...');
        
        // ==================== TABLE: Operators ====================
        console.log('\n👤 Creating Operators table...');
        await db.query('DROP TABLE IF EXISTS "Operators" CASCADE');
        await db.query(`
            CREATE TABLE "Operators" (
                operator_id VARCHAR(10) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                role VARCHAR(20) DEFAULT 'operator',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        `);
        console.log('✅ Operators table created');
        
        // ==================== TABLE: Task_History ====================
        console.log('\n📋 Creating Task_History table...');
        await db.query('DROP TABLE IF EXISTS "Task_History" CASCADE');
        await db.query(`
            CREATE TABLE "Task_History" (
                id SERIAL PRIMARY KEY,
                task_id VARCHAR(50),
                operator_id VARCHAR(10) NOT NULL,
                operator_name VARCHAR(100),
                task_type VARCHAR(20) NOT NULL,
                sku VARCHAR(50),
                quantity INTEGER,
                bins_used TEXT,
                status VARCHAR(20) DEFAULT 'completed',
                started_at TIMESTAMP,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                duration_minutes INTEGER
            )
        `);
        console.log('✅ Task_History table created (without foreign keys for now)');
        
        console.log('\n✅ Essential tables created successfully!');
        console.log('   - Operators: Ready for user signups');
        console.log('   - Task_History: Ready for task tracking\n');
        
        return { success: true };
        
    } catch (error) {
        console.error('❌ Error creating essential tables:', error);
        throw error;
    }
}

module.exports = { createEssentialTables };
