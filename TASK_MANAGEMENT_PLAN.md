# Task Management Implementation Plan

## Features to Implement:

### 1. Cancel Task (Step 1)
- ❌ Add "Cancel Task" button in incoming form
- ❌ Save to Task_History with status='cancelled'
- ❌ Return to dashboard

### 2. Bin Holding System
- Need new table: **Bin_Holds** to track temporarily reserved spaces
- Columns:
  - hold_id (SERIAL PRIMARY KEY)
  - bin_no (VARCHAR)
  - sku (VARCHAR)
  - cfc_held (INTEGER) - how much space is held
  - operator_id (VARCHAR)
  - task_id (INTEGER) - reference to pending task
  - created_at (TIMESTAMP)
  - expires_at (TIMESTAMP) - 30 minutes from creation
  - status (VARCHAR) - 'active', 'released', 'completed'

### 3. Pending Tasks Enhancement
- Already has Pending_Tasks table
- Need to add:
  - bins_held (TEXT) - JSON array of bins with quantities
  - expires_at (TIMESTAMP)
  - created_at (TIMESTAMP)

### 4. Task Flow:
1. **Step 1 → Cancel** → Task_History (status='cancelled')
2. **Step 2 → Proceed** → Create Pending_Task + Bin_Holds (30 min timer)
3. **Step 2 → Back** → Clear selections, stay in Step 2
4. **Step 3 → Cancel/Back** → Keep Pending_Task + Bin_Holds
5. **Step 3 → Complete** → Release holds, update inventory, delete pending task, add to Task_History (status='completed')
6. **Timer Expires** → Auto-release holds, Task_History (status='incomplete'), delete pending task

### 5. Background Job
- Cron job or periodic check (every minute)
- Find expired Pending_Tasks and Bin_Holds
- Release holds
- Move to Task_History as 'incomplete'

## Implementation Steps:

1. Create Bin_Holds table migration
2. Update Pending_Tasks table structure
3. Add cancel button in Step 1
4. Modify "Proceed to Scanning" to create holds
5. Add timer countdown in Step 3
6. Create background cleanup job
7. Update Task_History logging

