# Database Structure - Simple Explanation

## How the Bin Holding System Works

### 3 Main Tables Involved:

#### 1. **Bins** Table
This stores information about each physical bin (A01, A02, etc.)

```
Columns:
- bin_no: "A01", "A02", etc.
- cfc_capacity: 240 (max capacity)
- cfc_filled: How much actual inventory is in the bin
- cfc_held: How much space is TEMPORARILY RESERVED (not yet filled)
```

**Example:**
- A01 has 0 inventory (cfc_filled = 0)
- Someone reserves 50 CFC for an incoming task
- cfc_held = 50
- **Available space = 240 - 0 - 50 = 190**

---

#### 2. **Pending_Tasks** Table
When you select bins and proceed to QR scanning, a pending task is created.

```
Columns:
- id: Unique task ID
- operator_id: Who created this task
- sku: Which product
- bins_held: JSON array of which bins are held
  Example: [{"binNo":"A01","cfc":50}, {"binNo":"A02","cfc":30}]
- expires_at: When this task expires (30 seconds from creation)
- status: 'pending', 'completed', or 'expired'
```

**Purpose:** Tracks your active tasks and what bins they're holding

---

#### 3. **Bin_Holds** Table (Optional - might not exist)
This is a detailed record of each individual hold.

```
Columns:
- hold_id: Unique ID
- bin_no: Which bin
- cfc_held: How much space
- task_id: Links to Pending_Tasks.id
- status: 'active' or 'released'
- expires_at: When it expires
```

**Purpose:** More detailed tracking of holds

---

## The Problem You're Experiencing

**What SHOULD happen:**
1. You select bins (A01: 50 CFC, A02: 30 CFC)
2. System creates a Pending_Task with bins_held data
3. System updates Bins table: A01.cfc_held += 50, A02.cfc_held += 30
4. Available space shown: A01 = 190, A02 = 210
5. After 30 seconds OR if you cancel:
   - Auto-expiry finds the expired task
   - Reads bins_held: [{"binNo":"A01","cfc":50}, {"binNo":"A02","cfc":30}]
   - Updates Bins: A01.cfc_held -= 50, A02.cfc_held -= 30
   - Available space back to: A01 = 240, A02 = 240

**What's ACTUALLY happening:**
- Step 3 works (holds are created)
- Step 5 is NOT working (holds are not being released)
- Result: cfc_held keeps accumulating and never gets decremented

---

## Why It's Not Working

**Possible Reasons:**

### 1. **Server Not Restarted**
Azure might not have deployed the new code yet. The server is still running OLD code that doesn't have the bins_held column.

### 2. **Bins_Held Data Not Being Saved**
The frontend might be sending the data, but the server isn't storing it in the database.

### 3. **Auto-Expiry Not Running**
The background job that releases holds might not be executing.

### 4. **Bin_Holds Table Doesn't Exist**
If the migration wasn't run, the Bin_Holds table might not exist, and the auto-expiry is failing.

---

## Let's Check What's Actually in the Database

Run these commands in your browser console to see the real state:

### Check if bins_held is being saved:
```javascript
fetch('/api/pending-tasks/list?operatorId=OP001')
  .then(r=>r.json())
  .then(d=>console.log('Pending Tasks:', d));
```

### Check current bin states:
```javascript
fetch('/api/bins/available?sku=TEST')
  .then(r=>r.json())
  .then(d=>console.log('Bins:', d.bins.filter(b=>b.available<240)));
```

### Manual reset (temporary fix):
```javascript
fetch('/api/admin/reset-all-holds', {method:'POST'})
  .then(r=>r.json())
  .then(console.log);
```

---

## The Flow Diagram

```
User selects bins
    ↓
Frontend: createPendingTaskWithTimer()
    ↓
POST /api/pending-tasks/create
    ↓
Database: INSERT into Pending_Tasks (with bins_held)
    ↓
Frontend: createBinHolds(taskId)
    ↓
POST /api/bins/hold
    ↓
Database: 
  - INSERT into Bin_Holds (if table exists)
  - UPDATE Bins SET cfc_held = cfc_held + amount
    ↓
Available space decreases
    ↓
[30 seconds pass OR user cancels]
    ↓
Auto-expiry job runs (every 10 seconds)
    ↓
Finds expired Pending_Tasks
    ↓
Reads bins_held from task
    ↓
For each bin in bins_held:
  UPDATE Bins SET cfc_held = cfc_held - amount
    ↓
Available space restored
```

---

## What We Need to Debug

I need to check:
1. Is Azure actually running the new code?
2. Is bins_held being stored in the database?
3. Is the auto-expiry job running?
4. Are there error logs showing why it's failing?

Let me create a diagnostic script...
