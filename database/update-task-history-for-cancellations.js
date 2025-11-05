const db = require('./db');

async function updateTaskHistorySchema() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    console.log('Updating Task_History table for cancellation tracking...\n');
    
    // Check and add cancelled_at column
    const cancelledAtCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Task_History' AND column_name = 'cancelled_at'
    `);
    
    if (cancelledAtCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE "Task_History" 
        ADD COLUMN cancelled_at TIMESTAMP
      `);
      console.log('✅ Added cancelled_at column');
    } else {
      console.log('✓ cancelled_at column already exists');
    }
    
    // Check and add cancelled_reason column
    const reasonCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Task_History' AND column_name = 'cancelled_reason'
    `);
    
    if (reasonCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE "Task_History" 
        ADD COLUMN cancelled_reason TEXT
      `);
      console.log('✅ Added cancelled_reason column');
    } else {
      console.log('✓ cancelled_reason column already exists');
    }
    
    // Check and add operator column (without _id suffix)
    const operatorCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Task_History' AND column_name = 'operator'
    `);
    
    if (operatorCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE "Task_History" 
        ADD COLUMN operator VARCHAR(10)
      `);
      console.log('✅ Added operator column');
    } else {
      console.log('✓ operator column already exists');
    }
    
    // Check and add bins_involved column
    const binsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Task_History' AND column_name = 'bins_involved'
    `);
    
    if (binsCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE "Task_History" 
        ADD COLUMN bins_involved TEXT
      `);
      console.log('✅ Added bins_involved column');
    } else {
      console.log('✓ bins_involved column already exists');
    }
    
    // Check and add total_quantity column
    const qtyCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Task_History' AND column_name = 'total_quantity'
    `);
    
    if (qtyCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE "Task_History" 
        ADD COLUMN total_quantity INTEGER
      `);
      console.log('✅ Added total_quantity column');
    } else {
      console.log('✓ total_quantity column already exists');
    }
    
    // Check and add created_at column
    const createdAtCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Task_History' AND column_name = 'created_at'
    `);
    
    if (createdAtCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE "Task_History" 
        ADD COLUMN created_at TIMESTAMP
      `);
      console.log('✅ Added created_at column');
    } else {
      console.log('✓ created_at column already exists');
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Task_History table updated successfully for cancellation tracking!');
    
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
updateTaskHistorySchema()
  .then(() => {
    console.log('\n✨ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
