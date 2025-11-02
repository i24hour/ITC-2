const db = require('./database/db');
require('dotenv').config();

async function testConnection() {
    console.log('\n🧪 Testing PostgreSQL Connection...\n');
    
    try {
        // Test basic connection
        console.log('1. Testing basic connection...');
        const result = await db.query('SELECT NOW() as current_time, version() as version');
        console.log('   ✅ Connected successfully');
        console.log(`   ⏰ Server time: ${result.rows[0].current_time}`);
        console.log(`   📌 Version: ${result.rows[0].version.split(',')[0]}`);
        console.log('');
        
        // Test database existence
        console.log('2. Checking database...');
        const dbCheck = await db.query('SELECT current_database()');
        console.log(`   ✅ Database: ${dbCheck.rows[0].current_database}`);
        console.log('');
        
        // Test tables existence
        console.log('3. Checking tables...');
        const tables = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        if (tables.rows.length === 0) {
            console.log('   ⚠️  No tables found! Run migration:');
            console.log('      npm run migrate');
        } else {
            console.log(`   ✅ Found ${tables.rows.length} tables:`);
            tables.rows.forEach(row => {
                console.log(`      - ${row.table_name}`);
            });
        }
        console.log('');
        
        // Test data
        console.log('4. Checking data...');
        
        const inventoryCount = await db.query('SELECT COUNT(*) FROM inventory');
        console.log(`   📦 Inventory records: ${inventoryCount.rows[0].count}`);
        
        const skuCount = await db.query('SELECT COUNT(*) FROM active_skus WHERE is_active = true');
        console.log(`   🏷️  Active SKUs: ${skuCount.rows[0].count}`);
        
        const transactionCount = await db.query('SELECT COUNT(*) FROM transactions');
        console.log(`   📝 Transactions: ${transactionCount.rows[0].count}`);
        
        const taskCount = await db.query('SELECT COUNT(*) FROM tasks');
        console.log(`   📋 Tasks: ${taskCount.rows[0].count}`);
        console.log('');
        
        // Test sample query
        console.log('5. Testing sample query...');
        const sample = await db.query(`
            SELECT bin_no, sku, cfc 
            FROM inventory 
            WHERE cfc > 0 
            LIMIT 5
        `);
        
        if (sample.rows.length > 0) {
            console.log(`   ✅ Found ${sample.rows.length} sample records:`);
            sample.rows.forEach(row => {
                console.log(`      ${row.bin_no} | ${row.sku} | ${row.cfc} units`);
            });
        } else {
            console.log('   ⚠️  No inventory data found');
        }
        console.log('');
        
        // Connection pool status
        console.log('6. Connection pool status...');
        console.log(`   Total connections: ${db.pool.totalCount}`);
        console.log(`   Idle connections: ${db.pool.idleCount}`);
        console.log(`   Waiting requests: ${db.pool.waitingCount}`);
        console.log('');
        
        console.log('✅ All tests passed! Database is ready.\n');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('');
        console.error('Troubleshooting:');
        console.error('1. Check if PostgreSQL is running');
        console.error('2. Verify .env configuration');
        console.error('3. Ensure database exists: createdb -U postgres itc_warehouse');
        console.error('4. Run migrations: npm run migrate');
        console.error('');
    } finally {
        // Close pool
        await db.pool.end();
        process.exit(0);
    }
}

// Run test
testConnection();
