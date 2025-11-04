const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkInventory() {
    try {
        // Count total records
        const countResult = await pool.query('SELECT COUNT(*) as total FROM "Inventory"');
        console.log('Total Inventory records:', countResult.rows[0].total);
        
        // Count records with CFC > 0
        const cfcCountResult = await pool.query('SELECT COUNT(*) as total FROM "Inventory" WHERE cfc > 0');
        console.log('Inventory records with CFC > 0:', cfcCountResult.rows[0].total);
        
        // Get first 5 records
        const dataResult = await pool.query('SELECT * FROM "Inventory" LIMIT 5');
        console.log('\nFirst 5 inventory records:');
        console.log(JSON.stringify(dataResult.rows, null, 2));
        
        // Check column structure
        if (dataResult.rows.length > 0) {
            console.log('\nColumn names:', Object.keys(dataResult.rows[0]));
        }
        
        // Check if table exists
        const tableCheck = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'Inventory'
        `);
        console.log('\nInventory table structure:');
        console.log(tableCheck.rows);
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkInventory();
