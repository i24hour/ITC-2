const db = require('./db');

async function addTaskCancellationColumns() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    console.log('Adding cancellation columns to tasks table...');
    
    // Check if cancelled_at column exists
    const cancelledAtCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'cancelled_at'
    `);
    
    if (cancelledAtCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE tasks 
        ADD COLUMN cancelled_at TIMESTAMP
      `);
      console.log('✅ Added cancelled_at column');
    } else {
      console.log('✓ cancelled_at column already exists');
    }
    
    // Check if cancellation_reason column exists
    const reasonCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'cancellation_reason'
    `);
    
    if (reasonCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE tasks 
        ADD COLUMN cancellation_reason TEXT
      `);
      console.log('✅ Added cancellation_reason column');
    } else {
      console.log('✓ cancellation_reason column already exists');
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Task cancellation columns migration complete!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await db.end();
  }
}

// Run migration
addTaskCancellationColumns()
  .then(() => {
    console.log('\n✨ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
