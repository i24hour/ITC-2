# Task Management System - Testing Guide

## 🎯 Overview
Complete task management system with bin holding, timers, and auto-expiry.

## 📋 Pre-Testing Setup

### 1. Run Database Migration
**CRITICAL: Do this first!**

```bash
# Option 1: Use the web interface
Navigate to: http://localhost:3000/run-migration.html
Click "Run Migration" button

# Option 2: Use API directly
curl -X POST http://localhost:3000/api/admin/run-task-migration
```

**Expected Result:**
```json
{
  "success": true,
  "message": "Task management migration completed successfully",
  "changes": {
    "tables_created": ["Bin_Holds"],
    "tables_updated": ["Bins", "Pending_Tasks", "Task_History"]
  }
}
```

### 2. Verify Database Changes

```sql
-- Check Bin_Holds table exists
SELECT * FROM "Bin_Holds" LIMIT 1;

-- Check Bins table has new columns
SELECT bin_no, cfc_capacity, cfc_held FROM "Bins" LIMIT 1;

-- Check Pending_Tasks has new columns
SELECT id, bins_held, expires_at, status FROM "Pending_Tasks" LIMIT 1;

-- Check Task_History has new columns
SELECT id, started_at, duration_seconds, completed_at, status FROM "Task_History" LIMIT 1;
```

## 🧪 Test Scenarios

### Test 1: Cancel Task in Step 1
**Steps:**
1. Login as operator
2. Go to Incoming page
3. Enter SKU, CFC, Weight
4. Click "Cancel Task" button
5. Confirm cancellation

**Expected Results:**
- Redirected to dashboard
- Entry in Task_History with status='cancelled'
- Query: `SELECT * FROM "Task_History" WHERE status='cancelled' ORDER BY id DESC LIMIT 1;`

### Test 2: Proceed to Scanning (Create Holds)
**Steps:**
1. Login as operator
2. Enter SKU: (any valid SKU)
3. Enter CFC: 100
4. Click "Proceed to Bin Selection"
5. Select bins (e.g., G13: 50, L28: 50)
6. Click "Proceed to Scanning"

**Expected Results:**
- Timer starts at 30:00 and counts down
- Bin_Holds entries created
- Query: `SELECT * FROM "Bin_Holds" WHERE status='active' ORDER BY created_at DESC;`
- Bins table updated with cfc_held
- Query: `SELECT bin_no, cfc_filled, cfc_held FROM "Bins" WHERE bin_no IN ('G13', 'L28');`

### Test 3: Back to Dashboard (Holds Remain)
**Steps:**
1. Follow Test 2 to Step 3 (scanning)
2. Click "Cancel Scan" (Back to Dashboard)

**Expected Results:**
- Pending_Tasks entry created with bins_held JSONB
- Query: `SELECT * FROM "Pending_Tasks" ORDER BY created_at DESC LIMIT 1;`
- Bin_Holds remain active (status='active')
- Timer continues running in background
- User can resume task from dashboard

### Test 4: Complete Task Successfully
**Steps:**
1. Follow Test 2 to Step 3
2. Scan all selected bins
3. Click "Complete Incoming"

**Expected Results:**
- Timer stops
- Bin_Holds released (status='released')
- Query: `SELECT * FROM "Bin_Holds" WHERE task_id = ? ORDER BY updated_at DESC;`
- Bins.cfc_held decremented back to 0
- Pending_Tasks deleted
- Inventory updated with stock

### Test 5: Timer Expiry (30 minutes)
**For quick testing, modify timer to 2 minutes:**

In `incoming.js`, change line:
```javascript
// FROM:
timerEndTime = Date.now() + 30 * 60 * 1000; // 30 minutes

// TO:
timerEndTime = Date.now() + 2 * 60 * 1000; // 2 minutes for testing
```

**Steps:**
1. Follow Test 2 to Step 3
2. Wait 2 minutes (or 30 minutes with default)
3. Do NOT scan bins

**Expected Results:**
- Alert: "Task time expired!"
- Redirected to dashboard
- Bin_Holds released automatically
- Task_History entry with status='incomplete'
- Query: `SELECT * FROM "Task_History" WHERE status='incomplete' ORDER BY id DESC LIMIT 1;`

### Test 6: Auto-Expiry Background Job
**Steps:**
1. Create a pending task with holds
2. Manually update expires_at to past time:
```sql
UPDATE "Pending_Tasks" 
SET expires_at = NOW() - INTERVAL '1 minute' 
WHERE id = (SELECT MAX(id) FROM "Pending_Tasks");
```
3. Wait 60 seconds for background job to run

**Expected Results:**
- Console log: "⏰ Found 1 expired task(s), processing..."
- Holds released
- Task moved to Task_History as incomplete
- Pending task deleted

## 📊 Monitoring Queries

### Check Active Holds
```sql
SELECT h.*, b.cfc_capacity, b.cfc_filled, b.cfc_held
FROM "Bin_Holds" h
JOIN "Bins" b ON h.bin_no = b.bin_no
WHERE h.status = 'active'
ORDER BY h.created_at DESC;
```

### Check Pending Tasks with Expiry
```sql
SELECT *, 
  EXTRACT(EPOCH FROM (expires_at - NOW())) / 60 as minutes_remaining
FROM "Pending_Tasks"
WHERE status = 'pending'
ORDER BY expires_at ASC;
```

### Check Task History by Status
```sql
SELECT status, COUNT(*) as count
FROM "Task_History"
GROUP BY status;
```

### Check Bin Capacity Usage
```sql
SELECT bin_no, cfc_capacity, cfc_filled, cfc_held,
  (cfc_capacity - cfc_filled - cfc_held) as available_space
FROM "Bins"
WHERE cfc_held > 0
ORDER BY bin_no;
```

## 🐛 Debugging

### Enable Verbose Logging
Check server console for:
- `✅ Bin holds created`
- `⏰ Auto-expiry background job started`
- `⏰ Found X expired task(s), processing...`
- `✅ Expired task ID X moved to history as incomplete`

### Common Issues

**Issue: Holds not created**
- Check: Is migration run? `SELECT * FROM "Bin_Holds" LIMIT 1;`
- Check: Browser console for errors
- Check: API response in Network tab

**Issue: Timer not showing**
- Check: Element exists `<span id="time-remaining">`
- Check: Timer interval started in console
- Verify: `timerEndTime` is set

**Issue: Background job not running**
- Check server console for: "⏰ Auto-expiry background job started"
- Verify: setInterval is running (check at line ~4550 in server.js)

## 🔄 Reset for Testing

### Clear All Test Data
```sql
-- Clear holds
DELETE FROM "Bin_Holds";

-- Clear pending tasks
DELETE FROM "Pending_Tasks";

-- Clear task history
DELETE FROM "Task_History";

-- Reset bin holds
UPDATE "Bins" SET cfc_held = 0;
```

Or use the admin endpoint:
```bash
curl -X POST http://localhost:3000/api/admin/empty-all-tables
```

## ✅ Success Criteria

All tests should:
1. ✅ Cancel → Task_History (cancelled)
2. ✅ Proceed → Holds created + Timer starts
3. ✅ Back → Pending task saved + Holds remain
4. ✅ Complete → Holds released + Inventory updated
5. ✅ Expire → Auto-release + Task_History (incomplete)
6. ✅ Background job processes expired tasks every 60 seconds

## 📝 Notes

- Default timer: 30 minutes
- Background job runs every 60 seconds
- Holds are automatically released on expiry
- Bin capacity: 240 CFC (default)
- Available space = capacity - filled - held
