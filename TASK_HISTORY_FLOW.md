# 📋 Task History Flow - Complete Data Journey

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. TASK COMPLETION (Operator completes a task)                      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 📥 INCOMING.JS or 📤 OUTGOING.JS                                    │
│ File: public/incoming.js or public/outgoing.js                      │
│                                                                      │
│ When operator completes scanning:                                   │
│ - completeTask() or completeOutgoingTask() is called               │
│ - Collects data:                                                    │
│   • sessionToken (from localStorage)                                │
│   • taskType ('incoming' or 'outgoing')                            │
│   • sku (product code)                                              │
│   • quantity (total CFC)                                            │
│   • binsUsed (comma-separated: "A01, B03, C05")                    │
│   • startedAt (timestamp from taskStartTime)                        │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
                    POST /api/tasks/complete
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. BACKEND API ENDPOINT                                             │
│ File: server.js (Lines 257-309)                                     │
│ Endpoint: POST /api/tasks/complete                                  │
│                                                                      │
│ Process:                                                             │
│ 1. Validates sessionToken                                           │
│ 2. Gets operator_id and operator_name from session                 │
│ 3. Generates unique task_id                                         │
│ 4. Calculates duration = (completed_at - started_at) / 60000       │
│ 5. Inserts record into Task_History table                          │
│                                                                      │
│ SQL Query:                                                           │
│ INSERT INTO "Task_History"                                          │
│   (task_id, operator_id, operator_name, task_type, sku,            │
│    quantity, bins_used, status, started_at, completed_at,          │
│    duration_minutes)                                                 │
│ VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8, $9, $10)      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. DATABASE STORAGE                                                  │
│ Table: Task_History (Azure PostgreSQL)                              │
│                                                                      │
│ Stored Data:                                                         │
│ ┌───────────────────────────────────────────────────────┐          │
│ │ id              : 1 (auto-increment)                   │          │
│ │ task_id         : "TASK-1234567890-abc123"            │          │
│ │ operator_id     : "OP001"                             │          │
│ │ operator_name   : "John Doe"                          │          │
│ │ task_type       : "incoming"                          │          │
│ │ sku             : "SKU001"                            │          │
│ │ quantity        : 240                                  │          │
│ │ bins_used       : "A01, B03, C05"                     │          │
│ │ status          : "completed"                         │          │
│ │ started_at      : 2024-12-20 10:30:00                 │          │
│ │ completed_at    : 2024-12-20 10:45:00                 │          │
│ │ duration_minutes: 15                                   │          │
│ └───────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. DASHBOARD DISPLAY                                                 │
│ File: public/dashboard.html                                          │
│                                                                      │
│ On page load (DOMContentLoaded):                                    │
│ - Calls loadTaskHistory() function                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. FRONTEND FETCH REQUEST                                            │
│ File: public/dashboard.js (Lines 51-77)                             │
│ Function: loadTaskHistory()                                          │
│                                                                      │
│ Process:                                                             │
│ 1. Gets sessionToken from localStorage                              │
│ 2. Gets taskType filter value (if selected)                        │
│ 3. Builds query parameters                                          │
│ 4. Makes GET request to backend                                     │
│                                                                      │
│ Request:                                                             │
│ GET /api/task-history?sessionToken=session_abc123&limit=50         │
│     &taskType=incoming (optional)                                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. BACKEND QUERY ENDPOINT                                            │
│ File: server.js (Lines 322-372)                                     │
│ Endpoint: GET /api/task-history                                     │
│                                                                      │
│ Process:                                                             │
│ 1. Validates sessionToken                                           │
│ 2. Builds dynamic SQL query with filters                           │
│ 3. Applies filters (operatorId, taskType, dates)                   │
│ 4. Orders by completed_at DESC (newest first)                      │
│ 5. Limits results (default 100)                                     │
│                                                                      │
│ SQL Query:                                                           │
│ SELECT * FROM "Task_History"                                        │
│ WHERE 1=1                                                            │
│   AND task_type = 'incoming' (if filtered)                         │
│ ORDER BY completed_at DESC                                          │
│ LIMIT 50                                                             │
│                                                                      │
│ Returns JSON:                                                        │
│ {                                                                    │
│   success: true,                                                     │
│   taskHistory: [ {task1}, {task2}, ... ],                          │
│   count: 5                                                           │
│ }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 7. FRONTEND RENDERING                                                │
│ File: public/dashboard.js (Lines 78-122)                            │
│ Function: loadTaskHistory() - Display logic                         │
│                                                                      │
│ Process:                                                             │
│ 1. Receives JSON response from backend                              │
│ 2. Loops through taskHistory array                                  │
│ 3. For each task:                                                    │
│    - Creates a div element                                          │
│    - Formats dates (toLocaleDateString, toLocaleTimeString)        │
│    - Adds color-coded badge (green=incoming, blue=outgoing)        │
│    - Displays: operator, SKU, quantity, bins, duration              │
│ 4. Appends to #task-history-list div                               │
│                                                                      │
│ HTML Structure Created:                                              │
│ <div class="task-history-item">                                     │
│   <div> OP001 - John Doe </div>                                     │
│   <div> 📥 Incoming | SKU: SKU001 | Qty: 240 CFC </div>           │
│   <div> Bins Used: A01, B03, C05 </div>                            │
│   <div> Duration: 15 minutes </div>                                 │
│   <div> Status: ✓ completed </div>                                 │
│ </div>                                                               │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 8. USER SEES TASK HISTORY                                           │
│ Location: Dashboard page (dashboard.html)                           │
│ Section: "📋 Task History"                                          │
│                                                                      │
│ Features:                                                            │
│ ✓ Filter by task type (All/Incoming/Outgoing)                      │
│ ✓ Refresh button to reload                                          │
│ ✓ Scrollable list (max-height: 400px)                              │
│ ✓ Shows last 50 tasks                                               │
│ ✓ Ordered by newest first                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Source Summary

### **Database Table: Task_History**
```sql
Location: Azure PostgreSQL
Database: itc_warehouse
Table: Task_History

Schema:
- id (SERIAL PRIMARY KEY)
- task_id (INTEGER)
- operator_id (VARCHAR(10)) ← Links to Operators table
- operator_name (VARCHAR(100))
- task_type (VARCHAR(20)) ← 'incoming' or 'outgoing'
- sku (VARCHAR(50)) ← Links to Cleaned_FG_Master_file
- quantity (INTEGER) ← Total CFC
- bins_used (TEXT) ← Comma-separated bin numbers
- status (VARCHAR(20)) ← Default: 'completed'
- started_at (TIMESTAMP)
- completed_at (TIMESTAMP)
- duration_minutes (INTEGER) ← Auto-calculated
```

---

## 🔑 Key Files Involved

### **1. Data Writing (Task Completion)**
- `public/incoming.js` - Lines 612-640 (completeTask function)
- `public/outgoing.js` - Lines 672-704 (completeOutgoingTask function)
- `server.js` - Lines 257-309 (POST /api/tasks/complete endpoint)

### **2. Data Reading (Dashboard Display)**
- `public/dashboard.html` - Lines 170-188 (HTML structure)
- `public/dashboard.js` - Lines 51-122 (loadTaskHistory function)
- `server.js` - Lines 322-372 (GET /api/task-history endpoint)

### **3. Database Schema**
- `database/restructure.js` - Lines 155-177 (Task_History table creation)

---

## 🎯 Filter Options

The dashboard allows filtering by:

1. **Task Type:**
   - All Types (shows everything)
   - Incoming only
   - Outgoing only

2. **Limit:**
   - Default: 50 records
   - Can be changed via query parameter

3. **Future filters (can be added):**
   - By operator_id
   - By date range (startDate, endDate)
   - By SKU

---

## 🔄 Refresh Mechanism

Task history refreshes:
1. **On page load** - Automatically called
2. **On filter change** - When dropdown changes
3. **On refresh button click** - Manual refresh
4. **NOT automatic** - Does not auto-refresh every X seconds (can be added if needed)

---

## 💡 Example Data Flow

**Scenario:** John (OP001) completes an incoming task

```javascript
// 1. Frontend sends to backend
POST /api/tasks/complete
{
  sessionToken: "session_abc123...",
  taskType: "incoming",
  sku: "SKU001",
  quantity: 240,
  binsUsed: "A01, B03, C05",
  startedAt: "2024-12-20T10:30:00Z"
}

// 2. Backend saves to database
INSERT INTO Task_History VALUES (
  1,                              // id
  "TASK-1234567890-abc123",      // task_id
  "OP001",                        // operator_id
  "John Doe",                     // operator_name
  "incoming",                     // task_type
  "SKU001",                       // sku
  240,                            // quantity
  "A01, B03, C05",               // bins_used
  "completed",                    // status
  "2024-12-20 10:30:00",         // started_at
  "2024-12-20 10:45:00",         // completed_at
  15                              // duration_minutes
)

// 3. Dashboard fetches and displays
GET /api/task-history?sessionToken=session_abc123&limit=50

// 4. Backend returns
{
  success: true,
  taskHistory: [
    {
      id: 1,
      operator_id: "OP001",
      operator_name: "John Doe",
      task_type: "incoming",
      sku: "SKU001",
      quantity: 240,
      bins_used: "A01, B03, C05",
      duration_minutes: 15,
      completed_at: "2024-12-20T10:45:00Z",
      status: "completed"
    }
  ],
  count: 1
}

// 5. Frontend displays as card
┌─────────────────────────────────────┐
│ OP001 - John Doe                    │
│ 📥 Incoming | SKU: SKU001 | 240 CFC │
│ Bins: A01, B03, C05                 │
│ Duration: 15 minutes                │
│ Status: ✓ completed                 │
└─────────────────────────────────────┘
```

---

## 🎨 Visual Summary

**FROM:**
- Task completion in incoming/outgoing pages

**THROUGH:**
- POST /api/tasks/complete → Task_History table
- GET /api/task-history → Frontend

**TO:**
- Dashboard display with filters and formatting

**Data Journey:**
`Operator Action → Frontend JS → Backend API → PostgreSQL Database → Backend API → Frontend JS → User Display`

---

**Last Updated:** December 2024  
**Total Files Involved:** 6  
**Database Table:** Task_History  
**API Endpoints:** 2 (POST /api/tasks/complete, GET /api/task-history)
