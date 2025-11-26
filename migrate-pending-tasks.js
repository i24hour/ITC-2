// Migrate Pending_Tasks table to support nullable columns
const { Pool } = require('pg');

const pool = new Pool({
  host: 'itc-warehouse-db-2025.postgres.database.azure.com',
  port: 5432,
  user: 'itcadmin',
  password: 'WareHouse@2025',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function migratePendingTasks() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting Pending_Tasks table migration...\n');
    
    // Step 1: Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'Pending_Tasks'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Pending_Tasks table does not exist!');
      return;
    }
    
    console.log('✅ Pending_Tasks table exists\n');
    
    // Step 2: Check current table structure
    const columns = await client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'Pending_Tasks'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Current table structure:');
    columns.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (Nullable: ${col.is_nullable})`);
    });
    console.log('');
    
    // Step 3: Add batch_no column if not exists
    try {
      await client.query(`
        ALTER TABLE "Pending_Tasks" 
        ADD COLUMN IF NOT EXISTS batch_no VARCHAR(50)
      `);
      console.log('✅ Added batch_no column');
    } catch (err) {
      console.log('ℹ️  batch_no column already exists:', err.message);
    }
    
    // Step 4: Make bin_no nullable
    try {
      await client.query(`
        ALTER TABLE "Pending_Tasks" 
        ALTER COLUMN bin_no DROP NOT NULL
      `);
      console.log('✅ Made bin_no nullable');
    } catch (err) {
      console.log('ℹ️  bin_no already nullable:', err.message);
    }
    
    // Step 5: Make cfc nullable
    try {
      await client.query(`
        ALTER TABLE "Pending_Tasks" 
        ALTER COLUMN cfc DROP NOT NULL
      `);
      console.log('✅ Made cfc nullable');
    } catch (err) {
      console.log('ℹ️  cfc already nullable:', err.message);
    }
    
    console.log('\n📊 Verifying changes...\n');
    
    // Step 6: Verify changes
    const updatedColumns = await client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'Pending_Tasks'
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Updated table structure:');
    updatedColumns.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (Nullable: ${col.is_nullable})`);
    });
    
    console.log('\n🎉 Migration completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migratePendingTasks();
