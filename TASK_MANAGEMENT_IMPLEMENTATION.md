# Complete Task Management & Bin Holding System - Implementation Guide

## Summary
Aapko chahiye ek comprehensive task management system jo:
1. Tasks ko cancel kar sake
2. Bins ko temporarily hold kar sake  
3. Incomplete tasks ko track kare
4. Auto-expiry handle kare

## Current Status: PARTIALLY IMPLEMENTED ✅❌

**What's Already Working:**
✅ Pending Tasks save hote hain when "Cancel" click karte ho
✅ Dashboard me pending tasks dikhte hain
✅ Resume functionality hai

**What Needs to Be Added:**
❌ Step 1 me "Cancel Task" button
❌ Bin holding/reservation system
❌ 30-minute timer with auto-expiry
❌ Task History me status tracking (cancelled/incomplete/completed)

---

## Full Implementation Plan

### Phase 1: Database Schema Updates (REQUIRED FIRST)

#### Create Bin_Holds Table
```sql
CREATE TABLE "Bin_Holds" (
    hold_id SERIAL PRIMARY KEY,
    bin_no VARCHAR(50) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    cfc_held INTEGER NOT NULL,
    operator_id VARCHAR(10) NOT NULL,
    task_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    FOREIGN KEY (bin_no) REFERENCES "Bins"(bin_no),
    FOREIGN KEY (sku) REFERENCES "Cleaned_FG_Master_file"(sku),
    FOREIGN KEY (operator_id) REFERENCES "Operators"(operator_id)
);
```

#### Update Pending_Tasks Table
```sql
ALTER TABLE "Pending_Tasks" 
ADD COLUMN bins_held JSONB,
ADD COLUMN expires_at TIMESTAMP,
ADD COLUMN status VARCHAR(20) DEFAULT 'active';
```

#### Update Bins Table for Available Space
```sql
ALTER TABLE "Bins"
ADD COLUMN cfc_capacity INTEGER DEFAULT 240,
ADD COLUMN cfc_filled INTEGER DEFAULT 0,
ADD COLUMN cfc_held INTEGER DEFAULT 0;
```

---

### Phase 2: Backend API Endpoints

#### 1. Create Bin Hold
```javascript
POST /api/bins/hold
Body: {
  operatorId: 'OP001',
  bins: [
    { binNo: 'A01', sku: '210001', cfcToHold: 50 },
    { binNo: 'A02', sku: '210001', cfcToHold: 30 }
  ],
  taskId: 123,
  expiresIn: 1800 // 30 minutes in seconds
}
Response: {
  success: true,
  holds: [...],
  message: 'Bins reserved successfully'
}
```

#### 2. Release Bin Hold
```javascript
POST /api/bins/release-hold
Body: {
  taskId: 123
}
Response: {
  success: true,
  message: 'Holds released'
}
```

#### 3. Check Available Space
```javascript
GET /api/bins/available-space/:binNo
Response: {
  binNo: 'A01',
  capacity: 240,
  filled: 100,
  held: 50,
  available: 90
}
```

#### 4. Cancel Task
```javascript
POST /api/tasks/cancel
Body: {
  operatorId: 'OP001',
  taskType: 'incoming',
  sku: '210001',
  quantity: 80,
  reason: 'User cancelled'
}
Response: {
  success: true,
  taskId: 456,
  message: 'Task cancelled and saved to history'
}
```

#### 5. Auto-Expire Tasks (Background Job)
```javascript
// Run every minute
async function autoExpireTasks() {
  // Find expired pending tasks
  const expiredTasks = await db.query(`
    SELECT * FROM "Pending_Tasks" 
    WHERE expires_at < NOW() AND status = 'active'
  `);
  
  for (const task of expiredTasks.rows) {
    // Release bin holds
    await db.query(`
      UPDATE "Bin_Holds" 
      SET status = 'expired' 
      WHERE task_id = $1
    `, [task.id]);
    
    // Update bins - release held space
    // ...
    
    // Move to Task_History as incomplete
    await db.query(`
      INSERT INTO "Task_History" 
      (operator_id, task_type, sku, quantity, status, bins_used, started_at, completed_at)
      VALUES ($1, $2, $3, $4, 'incomplete', $5, $6, NOW())
    `, [task.operator_id, task.task_type, task.sku, task.cfc, task.bin_no, task.created_at]);
    
    // Delete pending task
    await db.query(`DELETE FROM "Pending_Tasks" WHERE id = $1`, [task.id]);
  }
}

// Start the job
setInterval(autoExpireTasks, 60000); // Every 1 minute
```

---

### Phase 3: Frontend Changes

#### incoming.js - Add Cancel Task Button Handler
```javascript
// Add in init function
document.getElementById('cancel-task-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to cancel this task?')) return;
    
    const user = JSON.parse(localStorage.getItem('user'));
    const sku = document.getElementById('sku-input').value;
    const cfc = document.getElementById('cfc-count').value;
    
    if (!sku || !cfc) {
        alert('Please fill in SKU and CFC details first');
        return;
    }
    
    try {
        const response = await fetch('/api/tasks/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operatorId: user.operatorId,
                taskType: 'incoming',
                sku: sku,
                quantity: parseInt(cfc),
                reason: 'Cancelled by operator'
            })
        });
        
        const result = await response.json();
        if (result.success) {
            alert('Task cancelled successfully');
            window.location.href = 'dashboard.html';
        }
    } catch (err) {
        console.error('Cancel failed:', err);
        alert('Failed to cancel task');
    }
});
```

#### Proceed to Scanning - Create Holds
```javascript
document.getElementById('proceed-to-scan').addEventListener('click', async () => {
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Create bin holds
    const holds = selectedBins.map(bin => ({
        binNo: bin.id,
        sku: incomingData.sku,
        cfcToHold: bin.quantity
    }));
    
    try {
        // First create pending task
        const taskResponse = await fetch('/api/pending-tasks/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operatorId: user.operatorId,
                taskType: 'incoming',
                sku: incomingData.sku,
                binNo: selectedBins.map(b => b.id).join(', '),
                cfc: incomingData.quantity,
                weight: incomingData.weight,
                bins_held: holds,
                expiresIn: 1800 // 30 minutes
            })
        });
        
        const taskResult = await taskResponse.json();
        const taskId = taskResult.task.id;
        
        // Create bin holds
        const holdResponse = await fetch('/api/bins/hold', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operatorId: user.operatorId,
                bins: holds,
                taskId: taskId,
                expiresIn: 1800
            })
        });
        
        if (holdResponse.ok) {
            // Save task ID for later
            localStorage.setItem('currentTaskId', taskId);
            
            // Start timer
            startTaskTimer(1800);
            
            // Move to step 3
            goToStep3();
        }
    } catch (err) {
        console.error('Failed to create holds:', err);
        alert('Failed to reserve bins. Please try again.');
    }
});
```

#### Timer Countdown
```javascript
let timerInterval;
let taskStartTime;

function startTaskTimer(seconds) {
    taskStartTime = Date.now();
    const endTime = taskStartTime + (seconds * 1000);
    
    timerInterval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        const minutes = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        
        document.getElementById('time-remaining').textContent = 
            `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        
        // Change color when < 5 minutes
        if (remaining < 300000) {
            document.getElementById('time-remaining').style.color = '#d9534f';
        }
        
        // Auto-expire
        if (remaining === 0) {
            clearInterval(timerInterval);
            alert('⏰ Time expired! Task has been marked as incomplete.');
            window.location.href = 'dashboard.html';
        }
    }, 1000);
}
```

#### Complete Task - Release Holds
```javascript
document.getElementById('complete-incoming').addEventListener('click', async () => {
    const taskId = localStorage.getItem('currentTaskId');
    
    // Release holds
    await fetch('/api/bins/release-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: parseInt(taskId) })
    });
    
    // Delete pending task
    await deletePendingTask();
    
    // Save to task history as completed
    // (This happens automatically in your existing code)
    
    // Clear timer
    clearInterval(timerInterval);
    localStorage.removeItem('currentTaskId');
    
    window.location.href = 'dashboard.html';
});
```

---

### Phase 4: Task History Status Tracking

#### Update Task_History Table
```sql
ALTER TABLE "Task_History"
ADD COLUMN started_at TIMESTAMP,
ADD COLUMN completed_at TIMESTAMP,
ADD COLUMN duration_seconds INTEGER;

-- Add constraint for status
ALTER TABLE "Task_History"
ADD CONSTRAINT task_status_check 
CHECK (status IN ('completed', 'cancelled', 'incomplete'));
```

#### Save to History with Proper Status
```javascript
async function saveTaskHistory(status) {
    const user = JSON.parse(localStorage.getItem('user'));
    const response = await fetch('/api/task-history/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            operatorId: user.operatorId,
            operatorName: user.name,
            taskType: 'incoming',
            sku: incomingData.sku,
            quantity: incomingData.quantity,
            binsUsed: selectedBins.map(b => b.id).join(', '),
            status: status, // 'completed', 'cancelled', 'incomplete'
            startedAt: taskStartTime,
            completedAt: Date.now(),
            durationSeconds: Math.floor((Date.now() - taskStartTime) / 1000)
        })
    });
}
```

---

## Testing Scenarios

### 1. Cancel in Step 1
- Fill SKU + CFC
- Click "Cancel Task"
- Check Task_History → status = 'cancelled'

### 2. Proceed then Back to Dashboard
- Fill details
- Select bins
- Click "Proceed to Scanning"
- Click "Back to Dashboard"
- Check Pending_Tasks → should exist
- Check Bin_Holds → status = 'active'
- Check bins → cfc_held should be updated

### 3. Resume Pending Task
- Dashboard → Click "Resume" on pending task
- Should go to Step 3 with timer running
- Complete normally
- Check holds released

### 4. Time Expiry
- Start task
- Wait 30 minutes (or change expiry to 1 minute for testing)
- Task should auto-expire
- Check Task_History → status = 'incomplete'
- Check Bin_Holds → status = 'expired'
- Check bins → cfc_held = 0

---

## Deployment Steps

1. **Run Database Migrations** (in order):
   ```
   node database/create-bin-holds-table.js
   node database/update-pending-tasks.js
   node database/update-bins-capacity.js
   node database/update-task-history.js
   ```

2. **Deploy Backend Changes**:
   - Add new API endpoints to server.js
   - Add background job for auto-expiry
   - Update existing endpoints to check bin capacity

3. **Deploy Frontend Changes**:
   - Update incoming.html (Cancel button)
   - Update incoming.js (all handlers)
   - Test thoroughly

4. **Monitor**:
   - Check Task_History for proper statuses
   - Monitor Bin_Holds for expired entries
   - Verify bins are released properly

---

## Estimated Development Time

- Database changes: 1 hour
- Backend APIs: 3-4 hours
- Frontend changes: 3-4 hours
- Testing: 2-3 hours
- **Total: 10-12 hours**

---

## Critical Notes

⚠️ **Bin Capacity Management**:
- Always check: `cfc_filled + cfc_held + incoming_quantity <= cfc_capacity`
- Prevent overbooking

⚠️ **Concurrent Access**:
- Use database transactions
- Lock rows when creating holds

⚠️ **Timer Accuracy**:
- Server-side expiry is authoritative
- Client-side timer is just for UX

⚠️ **Error Handling**:
- If hold creation fails, don't proceed to scanning
- If task expires during scan, gracefully handle

---

Yeh ek comprehensive implementation hai. Start karne ke liye pehle database tables create karo, phir backend APIs, phir frontend. Step by step karo toh 2-3 din me complete ho jayega! 🚀
