const db = require('./db');

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

// Create all essential tables without Excel dependency
async function createEssentialTables() {
    try {
        console.log('\n🔧 Creating all essential tables for warehouse system...');
        
        // ==================== TABLE 1: Bins ====================
        console.log('\n🗃️ Creating Bins table...');
        await db.query('DROP TABLE IF EXISTS "Bins" CASCADE');
        await db.query(`
            CREATE TABLE "Bins" (
                bin_no VARCHAR(50) PRIMARY KEY,
                category CHAR(1) NOT NULL,
                capacity INTEGER DEFAULT 240,
                current_quantity INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'empty',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        const bins = generateBins();
        for (const bin of bins) {
            await db.query('INSERT INTO "Bins" (bin_no, category) VALUES ($1, $2)', [bin, bin.charAt(0)]);
        }
        console.log(`✅ Bins table created with ${bins.length} bins`);
        
        // ==================== TABLE 2: Bin_Inventory ====================
        console.log('\n📦 Creating Bin_Inventory table...');
        await db.query('DROP TABLE IF EXISTS "Bin_Inventory" CASCADE');
        await db.query(`
            CREATE TABLE "Bin_Inventory" (
                id SERIAL PRIMARY KEY,
                bin_no VARCHAR(50) NOT NULL,
                sku VARCHAR(50) NOT NULL,
                batch_no VARCHAR(100),
                quantity INTEGER DEFAULT 0,
                date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expiry_date DATE,
                status VARCHAR(20) DEFAULT 'active',
                FOREIGN KEY (bin_no) REFERENCES "Bins"(bin_no)
            )
        `);
        console.log('✅ Bin_Inventory table created');
        
        // ==================== TABLE 3: Incoming ====================
        console.log('\n📥 Creating Incoming table...');
        await db.query('DROP TABLE IF EXISTS "Incoming" CASCADE');
        await db.query(`
            CREATE TABLE "Incoming" (
                id SERIAL PRIMARY KEY,
                sku VARCHAR(50) NOT NULL,
                batch_no VARCHAR(100),
                description TEXT,
                quantity INTEGER NOT NULL,
                weight DECIMAL(10,2),
                uom DECIMAL(10,3),
                bin_no VARCHAR(50),
                operator_id VARCHAR(10),
                incoming_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'completed',
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
                batch_no VARCHAR(100),
                description TEXT,
                quantity INTEGER NOT NULL,
                weight DECIMAL(10,2),
                uom DECIMAL(10,3),
                bin_no VARCHAR(50),
                operator_id VARCHAR(10),
                outgoing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'completed',
                FOREIGN KEY (bin_no) REFERENCES "Bins"(bin_no)
            )
        `);
        console.log('✅ Outgoing table created');
        
        // ==================== TABLE 5: Operators ====================
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
        
        // ==================== TABLE 6: Task_History ====================
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
        console.log('✅ Task_History table created');
        
        // ==================== TABLE 7: Historical_Log ====================
        console.log('\n📊 Creating Historical_Log table...');
        await db.query('DROP TABLE IF EXISTS "Historical_Log" CASCADE');
        await db.query(`
            CREATE TABLE "Historical_Log" (
                id SERIAL PRIMARY KEY,
                action_type VARCHAR(50) NOT NULL,
                table_name VARCHAR(50),
                record_id INTEGER,
                operator_id VARCHAR(10),
                details TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Historical_Log table created');
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ ALL TABLES CREATED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log(`🗃️  Bins: ${bins.length} bins (A01-P11)`);
        console.log('📦 Bin_Inventory: Ready for inventory tracking');
        console.log('📥 Incoming: Ready for receiving items');
        console.log('📤 Outgoing: Ready for dispatching items');
        console.log('👤 Operators: Ready for user signups');
        console.log('📋 Task_History: Ready for task tracking');
        console.log('📊 Historical_Log: Ready for audit logging');
        console.log('='.repeat(60) + '\n');
        
        return { 
            success: true,
            tables: [
                'Bins',
                'Bin_Inventory',
                'Incoming',
                'Outgoing',
                'Operators',
                'Task_History',
                'Historical_Log'
            ],
            binsCreated: bins.length
        };
        
    } catch (error) {
        console.error('❌ Error creating essential tables:', error);
        throw error;
    }
}

module.exports = { createEssentialTables, generateBins };
