const db = require('./database/db');

(async () => {
  const client = await db.getClient();
  try {
    console.log('\n=== Checking Operators Table ===');
    const operators = await client.query('SELECT operator_id, name, email FROM "Operators" ORDER BY operator_id LIMIT 10');
    console.log('Operators:', JSON.stringify(operators.rows, null, 2));
    
    console.log('\n=== Checking Task_History Table ===');
    const tasks = await client.query('SELECT operator_id, operator_name, task_type, sku FROM "Task_History" ORDER BY completed_at DESC LIMIT 5');
    console.log('Recent Tasks:', JSON.stringify(tasks.rows, null, 2));
    
    console.log('\n=== Checking User Sessions ===');
    const sessions = await client.query('SELECT session_token, user_email, user_name, operator_id FROM user_sessions WHERE expires_at > NOW() ORDER BY created_at DESC LIMIT 5');
    console.log('Active Sessions:', JSON.stringify(sessions.rows, null, 2));
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await db.close();
  }
})();
