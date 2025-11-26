// Test Pending Tasks System
// Use native fetch (Node 18+) or install node-fetch

const BASE_URL = 'https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net';

async function testPendingTasks() {
  console.log('🧪 Testing Pending Tasks System...\n');
  
  try {
    // Test 1: Create a pending task (minimal data - just SKU)
    console.log('📝 Test 1: Create pending task with minimal data...');
    const createResponse = await fetch(`${BASE_URL}/api/pending-tasks/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operatorId: 'OP001',
        taskType: 'incoming',
        sku: 'FXC1100PB',
        cfc: 50
      })
    });
    
    const createData = await createResponse.json();
    console.log('✅ Create Response:', createData);
    
    if (!createData.success) {
      console.error('❌ Failed to create task:', createData.error);
      return;
    }
    
    const taskId = createData.task.id;
    console.log(`✅ Task created with ID: ${taskId}\n`);
    
    // Test 2: List pending tasks
    console.log('📋 Test 2: List pending tasks for OP001...');
    const listResponse = await fetch(`${BASE_URL}/api/pending-tasks/list?operatorId=OP001`);
    const listData = await listResponse.json();
    console.log('✅ List Response:', JSON.stringify(listData, null, 2));
    
    if (listData.success && listData.tasks.length > 0) {
      console.log(`✅ Found ${listData.tasks.length} pending task(s)`);
      const task = listData.tasks[0];
      console.log(`   - Task ID: ${task.id}`);
      console.log(`   - Type: ${task.task_type}`);
      console.log(`   - SKU: ${task.sku}`);
      console.log(`   - CFC: ${task.cfc}`);
      console.log(`   - Bin: ${task.bin_no || 'Not selected'}`);
      console.log(`   - Time remaining: ${Math.floor(task.seconds_remaining / 60)}m ${Math.floor(task.seconds_remaining % 60)}s\n`);
    }
    
    // Test 3: Cancel the task
    console.log('🗑️  Test 3: Cancel pending task...');
    const cancelResponse = await fetch(`${BASE_URL}/api/pending-tasks/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    });
    
    const cancelData = await cancelResponse.json();
    console.log('✅ Cancel Response:', cancelData);
    
    if (cancelData.success) {
      console.log('✅ Task cancelled successfully\n');
    }
    
    // Test 4: Verify task is gone
    console.log('🔍 Test 4: Verify task is cancelled...');
    const verifyResponse = await fetch(`${BASE_URL}/api/pending-tasks/list?operatorId=OP001`);
    const verifyData = await verifyResponse.json();
    console.log('✅ Verify Response:', verifyData);
    
    if (verifyData.tasks.length === 0) {
      console.log('✅ No pending tasks found (task successfully cancelled)\n');
    } else {
      console.log(`⚠️  Still found ${verifyData.tasks.length} pending task(s)\n`);
    }
    
    console.log('🎉 All tests completed!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

// Run tests
testPendingTasks();
