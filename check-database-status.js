const db = require('./database/db');

(async () => {
  const client = await db.getClient();
  try {
    console.log('\n========================================');
    console.log('📊 DATABASE STATUS CHECK');
    console.log('========================================\n');
    
    // Check if tables exist
    console.log('🔍 Checking if tables exist...\n');
    
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('Operators', 'Task_History', 'user_sessions')
      ORDER BY table_name;
    `);
    
    console.log('✅ Existing tables:');
    tablesCheck.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    console.log('');
    
    // Check Operators table
    try {
      const operatorsCount = await client.query('SELECT COUNT(*) as count FROM "Operators"');
      const operatorsData = await client.query('SELECT operator_id, name, email, created_at FROM "Operators" ORDER BY created_at DESC LIMIT 10');
      
      console.log('========================================');
      console.log('👥 OPERATORS TABLE');
      console.log('========================================');
      console.log(`Total operators: ${operatorsCount.rows[0].count}`);
      
      if (operatorsData.rows.length > 0) {
        console.log('\nRecent operators:');
        operatorsData.rows.forEach(op => {
          console.log(`   ${op.operator_id} | ${op.name} | ${op.email} | Created: ${op.created_at}`);
        });
      } else {
        console.log('❌ No operators found!');
      }
      console.log('');
    } catch (e) {
      console.log('❌ Operators table does not exist or error:', e.message);
      console.log('');
    }
    
    // Check Task_History table
    try {
      const tasksCount = await client.query('SELECT COUNT(*) as count FROM "Task_History"');
      const tasksData = await client.query(`
        SELECT id, operator_id, operator_name, task_type, sku, quantity, completed_at 
        FROM "Task_History" 
        ORDER BY completed_at DESC 
        LIMIT 10
      `);
      
      console.log('========================================');
      console.log('📋 TASK_HISTORY TABLE');
      console.log('========================================');
      console.log(`Total tasks: ${tasksCount.rows[0].count}`);
      
      if (tasksData.rows.length > 0) {
        console.log('\nRecent tasks:');
        tasksData.rows.forEach(task => {
          console.log(`   ID: ${task.id} | ${task.operator_id} (${task.operator_name}) | ${task.task_type} | SKU: ${task.sku} | Qty: ${task.quantity} | ${task.completed_at}`);
        });
      } else {
        console.log('❌ No tasks found! (Table is EMPTY)');
        console.log('💡 Complete a task in Incoming or Outgoing pages to populate this table.');
      }
      console.log('');
    } catch (e) {
      console.log('❌ Task_History table does not exist or error:', e.message);
      console.log('');
    }
    
    // Check user_sessions table
    try {
      const sessionsCount = await client.query('SELECT COUNT(*) as count FROM user_sessions');
      const activeSessions = await client.query(`
        SELECT session_token, user_email, user_name, operator_id, created_at, expires_at 
        FROM user_sessions 
        WHERE expires_at > NOW() 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      console.log('========================================');
      console.log('🔐 USER_SESSIONS TABLE');
      console.log('========================================');
      console.log(`Total sessions: ${sessionsCount.rows[0].count}`);
      console.log(`Active sessions (not expired): ${activeSessions.rows.length}`);
      
      if (activeSessions.rows.length > 0) {
        console.log('\nActive sessions:');
        activeSessions.rows.forEach(session => {
          console.log(`   ${session.operator_id || 'N/A'} | ${session.user_name} | ${session.user_email} | Expires: ${session.expires_at}`);
        });
      }
      console.log('');
    } catch (e) {
      console.log('❌ user_sessions table does not exist or error:', e.message);
      console.log('');
    }
    
    console.log('========================================');
    console.log('✅ DATABASE CHECK COMPLETE');
    console.log('========================================\n');
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
  } finally {
    client.release();
    await db.close();
  }
})();
