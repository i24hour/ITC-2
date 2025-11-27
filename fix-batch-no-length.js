const { Client } = require('pg');

const client = new Client({
  host: 'itc-warehouse-db-2025.postgres.database.azure.com',
  port: 5432,
  database: 'itc_warehouse',
  user: 'itcadmin',
  password: 'priyanshu@123',
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  try {
    await client.connect();
    console.log('✅ Connected\n');

    // Check all tables with batch_no column
    const tables = ['Inventory', 'Incoming', 'Outgoing', 'Task_History', 'Bin_Inventory'];
    
    for (const table of tables) {
      console.log(`\n📋 Checking ${table} table...`);
      
      try {
        const result = await client.query(`
          SELECT column_name, data_type, character_maximum_length 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'batch_no'
        `, [table]);
        
        if (result.rows.length > 0) {
          const col = result.rows[0];
          console.log(`   batch_no: ${col.data_type}(${col.character_maximum_length})`);
        } else {
          console.log('   ⚠️  No batch_no column found');
        }
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
      }
    }

    // Fix: Increase batch_no length to 50 for all tables
    console.log('\n\n🔧 Fixing batch_no column length to VARCHAR(50)...\n');
    
    for (const table of tables) {
      try {
        await client.query(`ALTER TABLE "${table}" ALTER COLUMN batch_no TYPE VARCHAR(50)`);
        console.log(`   ✅ ${table} - batch_no updated to VARCHAR(50)`);
      } catch (err) {
        console.log(`   ⚠️  ${table} - ${err.message}`);
      }
    }

    console.log('\n✅ All done!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSchema();
