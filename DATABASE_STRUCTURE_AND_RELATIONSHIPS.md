# 📊 ITC Warehouse Database Structure & Data Flow

## 🗄️ Complete Database Schema (7 Tables)

---

## 📋 TABLE 1: Cleaned_FG_Master_file (SKU Master Data)

**Purpose:** Master reference table for all product SKUs

```sql
CREATE TABLE "Cleaned_FG_Master_file" (
    sku VARCHAR(50) PRIMARY KEY,           -- Unique SKU identifier
    description TEXT NOT NULL,             -- Product description
    uom DECIMAL(10,3) NOT NULL,           -- Unit of Measurement (kg per CFC)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**Current Data:**
- **47 SKUs** loaded from Excel file
- Examples: "SKU001", "SKU002", "SKU003"...
- Each has description and UOM value

**Relationships:**
- ✅ **Referenced by:** Inventory, Incoming, Outgoing, Task_History (via SKU)
- ❌ **References:** None (Master table)

---

## 🗃️ TABLE 2: Bins (Physical Storage Locations)

**Purpose:** Master list of all physical storage bins in warehouse

```sql
CREATE TABLE "Bins" (
    bin_no VARCHAR(50) PRIMARY KEY,        -- Bin identifier (A01, B03, etc.)
    category CHAR(1) NOT NULL,             -- Category letter (A-P)
    capacity INTEGER DEFAULT 240,          -- Max CFC capacity (240)
    status VARCHAR(20) DEFAULT 'empty',    -- Current status
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**Current Data:**
- **138 Total Bins:**
  - A: 8 bins (A01-A08)
  - B: 7 bins (B01-B07)
  - C: 7 bins (C01-C07)
  - D-O: 8 bins each (D01-O08) = 96 bins
  - P: 11 bins (P01-P11)
- **Capacity:** 240 CFC per bin
- **Status:** All start as 'empty'

**Relationships:**
- ✅ **Referenced by:** Inventory, Incoming, Outgoing (via bin_no)
- ❌ **References:** None (Master table)

---

## 📦 TABLE 3: Inventory (Current Stock Status)

**Purpose:** Real-time snapshot of what's currently in each bin

```sql
CREATE TABLE "Inventory" (
    id SERIAL PRIMARY KEY,
    bin_no VARCHAR(50) NOT NULL,           -- Which bin?
    sku VARCHAR(50) NOT NULL,              -- Which product?
    batch_no VARCHAR(100) NOT NULL,        -- Which batch?
    cfc INTEGER DEFAULT 0,                 -- How many cartons?
    description TEXT NOT NULL,             -- Product description (copied)
    uom DECIMAL(10,3) NOT NULL,           -- UOM (copied)
    created_at TIMESTAMP,                  -- When first added
    updated_at TIMESTAMP,                  -- Last updated
    FOREIGN KEY (sku) REFERENCES "Cleaned_FG_Master_file"(sku),
    FOREIGN KEY (bin_no) REFERENCES "Bins"(bin_no)
)
```

**Current Data:**
- **Initially 0 records** (all bins empty)
- **Grows as:** Operators scan incoming inventory
- **Updates when:** Incoming adds CFC, Outgoing deducts CFC

**Example Records (After Operations):**
```
| bin_no | sku    | batch_no | cfc | description        | uom   |
|--------|--------|----------|-----|--------------------|-------|
| A01    | SKU001 | BATCH123 | 150 | Product ABC        | 25.5  |
| B03    | SKU001 | BATCH123 | 90  | Product ABC        | 25.5  |
| C05    | SKU002 | BATCH456 | 200 | Product XYZ        | 30.0  |
```

**Relationships:**
- ✅ **References:** Cleaned_FG_Master_file (sku), Bins (bin_no)
- ❌ **Referenced by:** None (Operational table)

**Data Interaction:**
1. **Incoming Process** → Creates/Updates records (adds CFC)
2. **Outgoing Process** → Updates records (deducts CFC)
3. **Frontend** → Reads to show bin availability

---

## 📥 TABLE 4: Incoming (Transaction Log)

**Purpose:** Historical record of all incoming inventory transactions

```sql
CREATE TABLE "Incoming" (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) NOT NULL,              -- Which product came in?
    batch_no VARCHAR(100) NOT NULL,        -- Which batch?
    description TEXT NOT NULL,             -- Product description
    weight DECIMAL(10,2) NOT NULL,        -- Total weight
    uom DECIMAL(10,3) NOT NULL,           -- UOM value
    cfc INTEGER NOT NULL,                  -- How many cartons?
    bin_no VARCHAR(50),                    -- Which bin placed in?
    incoming_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sku) REFERENCES "Cleaned_FG_Master_file"(sku),
    FOREIGN KEY (bin_no) REFERENCES "Bins"(bin_no)
)
```

**Current Data:**
- **Initially 0 records**
- **Grows with each:** Incoming transaction

**Example Records:**
```
| id | sku    | batch_no | weight | cfc | bin_no | incoming_date       |
|----|--------|----------|--------|-----|--------|---------------------|
| 1  | SKU001 | BATCH123 | 3825.0 | 150 | A01    | 2024-12-20 10:30:00 |
| 2  | SKU001 | BATCH123 | 2295.0 | 90  | B03    | 2024-12-20 10:35:00 |
| 3  | SKU002 | BATCH456 | 6000.0 | 200 | C05    | 2024-12-20 11:00:00 |
```

**Relationships:**
- ✅ **References:** Cleaned_FG_Master_file (sku), Bins (bin_no)
- ❌ **Referenced by:** None (Log table)

**Data Interaction:**
1. **Operator completes incoming scan** → New record inserted
2. **Never deleted** (permanent transaction log)
3. **Used for:** Reports, auditing, FIFO tracking

---

## 📤 TABLE 5: Outgoing (Dispatch Log)

**Purpose:** Historical record of all outgoing/dispatch transactions

```sql
CREATE TABLE "Outgoing" (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) NOT NULL,              -- Which product dispatched?
    batch_no VARCHAR(100) NOT NULL,        -- Which batch?
    description TEXT NOT NULL,             -- Product description
    weight DECIMAL(10,2) NOT NULL,        -- Total weight
    uom DECIMAL(10,3) NOT NULL,           -- UOM value
    cfc INTEGER NOT NULL,                  -- How many cartons?
    bin_no VARCHAR(50),                    -- Which bin taken from?
    dod TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Date of Dispatch
    FOREIGN KEY (sku) REFERENCES "Cleaned_FG_Master_file"(sku),
    FOREIGN KEY (bin_no) REFERENCES "Bins"(bin_no)
)
```

**Current Data:**
- **Initially 0 records**
- **Grows with each:** Outgoing transaction

**Example Records:**
```
| id | sku    | batch_no | weight | cfc | bin_no | dod                 |
|----|--------|----------|--------|-----|--------|---------------------|
| 1  | SKU001 | BATCH123 | 1275.0 | 50  | A01    | 2024-12-21 14:20:00 |
| 2  | SKU001 | BATCH123 | 765.0  | 30  | B03    | 2024-12-21 14:25:00 |
| 3  | SKU002 | BATCH456 | 1500.0 | 50  | C05    | 2024-12-21 15:00:00 |
```

**Relationships:**
- ✅ **References:** Cleaned_FG_Master_file (sku), Bins (bin_no)
- ❌ **Referenced by:** None (Log table)

**Data Interaction:**
1. **Operator completes outgoing scan** → New record inserted
2. **Never deleted** (permanent transaction log)
3. **Used for:** Reports, auditing, dispatch history
4. **FIFO System:** Oldest batches dispatched first

---

## 👤 TABLE 6: Operators (User Accounts)

**Purpose:** Store operator/user account information

```sql
CREATE TABLE "Operators" (
    operator_id VARCHAR(10) PRIMARY KEY,   -- Auto: OP001, OP002, OP003...
    name VARCHAR(100) NOT NULL,            -- Full name
    email VARCHAR(100) UNIQUE NOT NULL,    -- Email (unique)
    password_hash VARCHAR(255),            -- Password hash
    role VARCHAR(20) DEFAULT 'operator',   -- Role (operator/supervisor)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP                   -- Last login time
)
```

**Current Data:**
- **Initially 0 records**
- **Grows as:** New operators sign up

**Example Records:**
```
| operator_id | name         | email              | role       | created_at          | last_login          |
|-------------|--------------|--------------------|-----------|--------------------|---------------------|
| OP001       | John Doe     | john@itc.com       | operator  | 2024-12-20 08:00:00| 2024-12-20 10:30:00|
| OP002       | Jane Smith   | jane@itc.com       | operator  | 2024-12-20 08:15:00| 2024-12-20 09:45:00|
| OP003       | Bob Manager  | bob@itc.com        | supervisor| 2024-12-20 08:30:00| 2024-12-20 11:00:00|
```

**Relationships:**
- ✅ **Referenced by:** Task_History (via operator_id)
- ❌ **References:** None (Master table)

**Data Interaction:**
1. **Signup** → New operator created, ID auto-generated
2. **Login** → last_login updated
3. **Session** → operator_id stored in session
4. **Task completion** → operator_id logged in Task_History

**Auto-ID Generation:**
```javascript
// Count existing operators
const count = await query('SELECT COUNT(*) FROM "Operators"');
const nextNumber = count + 1;
const operatorId = `OP${String(nextNumber).padStart(3, '0')}`;
// Result: OP001, OP002, OP003... OP010, OP011... OP099, OP100...
```

---

## 📋 TABLE 7: Task_History (Activity Tracking)

**Purpose:** Complete log of all operator tasks with performance metrics

```sql
CREATE TABLE "Task_History" (
    id SERIAL PRIMARY KEY,
    task_id INTEGER,                       -- Task identifier
    operator_id VARCHAR(10) NOT NULL,      -- Who did it?
    operator_name VARCHAR(100),            -- Operator name (cached)
    task_type VARCHAR(20) NOT NULL,        -- 'incoming' or 'outgoing'
    sku VARCHAR(50),                       -- Which product?
    quantity INTEGER,                      -- How many CFC?
    bins_used TEXT,                        -- Which bins? (comma-separated)
    status VARCHAR(20) DEFAULT 'completed',-- Task status
    started_at TIMESTAMP,                  -- When started
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- When completed
    duration_minutes INTEGER,              -- How long it took
    FOREIGN KEY (operator_id) REFERENCES "Operators"(operator_id),
    FOREIGN KEY (sku) REFERENCES "Cleaned_FG_Master_file"(sku)
)
```

**Current Data:**
- **Initially 0 records**
- **Grows with each:** Completed task

**Example Records:**
```
| id | operator_id | operator_name | task_type | sku    | quantity | bins_used      | started_at          | completed_at        | duration_minutes |
|----|-------------|---------------|-----------|--------|----------|----------------|---------------------|---------------------|------------------|
| 1  | OP001       | John Doe      | incoming  | SKU001 | 240      | A01, B03, C05  | 2024-12-20 10:30:00 | 2024-12-20 10:45:00 | 15               |
| 2  | OP002       | Jane Smith    | outgoing  | SKU002 | 150      | C05, D01       | 2024-12-20 11:00:00 | 2024-12-20 11:12:00 | 12               |
| 3  | OP001       | John Doe      | incoming  | SKU003 | 180      | E02, F03       | 2024-12-20 14:20:00 | 2024-12-20 14:38:00 | 18               |
```

**Relationships:**
- ✅ **References:** Operators (operator_id), Cleaned_FG_Master_file (sku)
- ❌ **Referenced by:** None (Log/Analytics table)

**Data Interaction:**
1. **Task Start** → startTime recorded when operator enters step 2
2. **Task Complete** → Record inserted with all details
3. **Duration Calculation:** `(completed_at - started_at) / 60000` milliseconds
4. **Dashboard Display** → Fetched and displayed with filters

---

## 🔄 DATA FLOW DIAGRAM

### 1️⃣ Incoming Process (Receiving Inventory)

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Operator Enters Details                                 │
│ - Select SKU from dropdown (from Cleaned_FG_Master_file)        │
│ - Enter Quantity (CFC count)                                     │
│ - Enter Weight                                                   │
│ ↓ Fetches SKU description and UOM from Cleaned_FG_Master_file  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Select Bins (Task Timer Starts)                         │
│ - System queries Inventory + Bins tables                        │
│ - Shows partially filled bins (same SKU)                        │
│ - Shows empty bins                                               │
│ - Operator selects bins and allocates quantities               │
│ - taskStartTime = new Date()                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Scan QR Codes                                           │
│ - Operator scans each bin QR code                              │
│ - System validates bin exists in Bins table                     │
│ - For each scan:                                                │
│   ✓ UPDATE Inventory: Add CFC to bin (creates if new)          │
│   ✓ INSERT Incoming: Log transaction with timestamp            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Task Completion                                         │
│ - Calculate duration = completed_at - started_at                │
│ - INSERT Task_History:                                          │
│   • operator_id (from session)                                  │
│   • task_type = 'incoming'                                      │
│   • sku, quantity, bins_used                                    │
│   • started_at, completed_at, duration_minutes                  │
└─────────────────────────────────────────────────────────────────┘
```

**Database Writes:**
- ✍️ **Inventory:** 1 record per bin (INSERT or UPDATE)
- ✍️ **Incoming:** 1 record per bin (INSERT)
- ✍️ **Task_History:** 1 record per task (INSERT)

---

### 2️⃣ Outgoing Process (FIFO Dispatch)

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Search Product                                          │
│ - Select SKU from dropdown (from Cleaned_FG_Master_file)        │
│ - Enter Quantity to dispatch                                    │
│ - Enter Batch Number (optional)                                 │
│ ↓ Fetches SKU description and UOM from Cleaned_FG_Master_file  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: FIFO Bin Selection (Task Timer Starts)                 │
│ - System queries Inventory table for matching SKU               │
│ - Orders by created_at ASC (FIFO - First In, First Out)        │
│ - Shows bins with oldest inventory first                        │
│ - Operator selects quantities from each bin                     │
│ - taskStartTime = new Date()                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Scan QR Codes                                           │
│ - Operator scans each bin QR code in FIFO order                │
│ - System validates bin exists in Bins table                     │
│ - For each scan:                                                │
│   ✓ UPDATE Inventory: Deduct CFC from bin                      │
│   ✓ INSERT Outgoing: Log dispatch with timestamp               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Task Completion                                         │
│ - Calculate duration = completed_at - started_at                │
│ - INSERT Task_History:                                          │
│   • operator_id (from session)                                  │
│   • task_type = 'outgoing'                                      │
│   • sku, quantity, bins_used                                    │
│   • started_at, completed_at, duration_minutes                  │
└─────────────────────────────────────────────────────────────────┘
```

**Database Writes:**
- ✍️ **Inventory:** 1 UPDATE per bin (deducts CFC)
- ✍️ **Outgoing:** 1 record per bin (INSERT)
- ✍️ **Task_History:** 1 record per task (INSERT)

---

## 🔗 TABLE RELATIONSHIPS & FOREIGN KEYS

```
┌──────────────────────────┐
│ Cleaned_FG_Master_file   │ ◄─────┐
│ (Master: 47 SKUs)        │       │
│ - sku (PK)               │       │ FOREIGN KEY
│ - description            │       │
│ - uom                    │       │
└──────────────────────────┘       │
        ▲                           │
        │ FOREIGN KEY               │
        │                           │
        ├───────────────────────────┼─────────────┐
        │                           │             │
┌───────┴──────────┐  ┌─────────────┴────┐  ┌────┴─────────────┐
│   Inventory      │  │    Incoming      │  │    Outgoing      │
│ - sku (FK) ─────►│  │  - sku (FK) ────►│  │  - sku (FK) ────►│
│ - bin_no (FK)    │  │  - bin_no (FK)   │  │  - bin_no (FK)   │
│ - batch_no       │  │  - batch_no      │  │  - batch_no      │
│ - cfc            │  │  - cfc           │  │  - cfc           │
└──────────────────┘  └──────────────────┘  └──────────────────┘
        │                     │                      │
        │ FOREIGN KEY         │ FOREIGN KEY          │ FOREIGN KEY
        │                     │                      │
        ▼                     ▼                      ▼
┌──────────────────────┐
│       Bins           │
│ (Master: 138 bins)   │
│ - bin_no (PK)        │
│ - category           │
│ - capacity: 240      │
└──────────────────────┘


┌──────────────────────┐
│     Operators        │ ◄─────┐
│ (User Accounts)      │       │
│ - operator_id (PK)   │       │ FOREIGN KEY
│   (OP001, OP002...)  │       │
│ - name               │       │
│ - email              │       │
└──────────────────────┘       │
                               │
                        ┌──────┴──────────┐
                        │  Task_History   │
                        │ - operator_id ──►│
                        │   (FK)          │
                        │ - sku (FK) ─────┼──► Cleaned_FG_Master_file
                        │ - task_type     │
                        │ - quantity      │
                        │ - bins_used     │
                        │ - duration_min  │
                        └─────────────────┘
```

---

## 📊 DATA FLOW SUMMARY

### Master Data (Read-Only, Reference):
1. **Cleaned_FG_Master_file** - SKU catalog (47 items)
2. **Bins** - Physical locations (138 bins)
3. **Operators** - User accounts (grows with signups)

### Operational Data (Read/Write, Updates):
4. **Inventory** - Current stock levels (live data)
   - **Written by:** Incoming (+), Outgoing (-)
   - **Read by:** Dashboard, Reports, Frontend

### Transaction Logs (Write-Only, Historical):
5. **Incoming** - Receipt log (never deleted)
6. **Outgoing** - Dispatch log (never deleted)
7. **Task_History** - Activity log (never deleted)

---

## 🎯 KEY DATA INTERACTIONS

### 1. SKU Lookup Flow:
```
User selects SKU → Fetch from Cleaned_FG_Master_file → Display description & UOM
```

### 2. Bin Availability Flow:
```
User needs bins → Query Inventory + Bins → Show available space per bin
```

### 3. FIFO Dispatch Flow:
```
User dispatches → Query Inventory ORDER BY created_at ASC → Oldest first
```

### 4. Task Tracking Flow:
```
Task starts → Record startTime → Task completes → Calculate duration → Log to Task_History
```

### 5. Operator Session Flow:
```
Login → Fetch from Operators → Store operator_id in session → Use for Task_History
```

### 6. Dashboard Analytics:
```
Dashboard loads → Fetch Task_History → Filter by operator/type → Display with metrics
```

---

## 🔢 CURRENT DATA COUNTS

| Table                    | Initial Count | Grows With           | Purpose                |
|--------------------------|---------------|----------------------|------------------------|
| Cleaned_FG_Master_file   | 47 SKUs       | Manual updates       | Product catalog        |
| Bins                     | 138 bins      | Fixed (unless added) | Storage locations      |
| Operators                | 0             | New signups          | User accounts          |
| Inventory                | 0             | Incoming/Outgoing    | Current stock          |
| Incoming                 | 0             | Each receipt         | Transaction log        |
| Outgoing                 | 0             | Each dispatch        | Transaction log        |
| Task_History             | 0             | Each task            | Activity tracking      |

---

## 💡 DATA INTEGRITY RULES

### Foreign Key Constraints:
✅ **Inventory.sku** must exist in **Cleaned_FG_Master_file.sku**  
✅ **Inventory.bin_no** must exist in **Bins.bin_no**  
✅ **Incoming.sku** must exist in **Cleaned_FG_Master_file.sku**  
✅ **Incoming.bin_no** must exist in **Bins.bin_no**  
✅ **Outgoing.sku** must exist in **Cleaned_FG_Master_file.sku**  
✅ **Outgoing.bin_no** must exist in **Bins.bin_no**  
✅ **Task_History.operator_id** must exist in **Operators.operator_id**  
✅ **Task_History.sku** must exist in **Cleaned_FG_Master_file.sku**  

### Business Rules:
✅ **Bin capacity:** Max 240 CFC per bin  
✅ **Operator IDs:** Auto-generated sequential (OP001, OP002...)  
✅ **FIFO:** Oldest inventory dispatched first  
✅ **Task duration:** Calculated automatically (completed_at - started_at)  
✅ **Bins:** Only 138 valid bins can be scanned  

---

## 🎨 SUMMARY: "The Big Picture"

**Your database is like a warehouse management system with 7 interconnected filing cabinets:**

1. 📋 **SKU Catalog** (Cleaned_FG_Master_file) - "What products do we have?"
2. 🗃️ **Bin Locations** (Bins) - "Where can we store things?"
3. 👤 **Employee Records** (Operators) - "Who works here?"
4. 📦 **Current Inventory** (Inventory) - "What's in the warehouse RIGHT NOW?"
5. 📥 **Receipt Journal** (Incoming) - "What came in? When? Who received it?"
6. 📤 **Dispatch Journal** (Outgoing) - "What went out? When? Who sent it?"
7. 📋 **Activity Log** (Task_History) - "Who did what? How long did it take?"

**Every action in the system updates multiple tables to keep everything synchronized!**

---

**Generated:** December 2024  
**Database:** Azure PostgreSQL  
**Total Tables:** 7  
**Total Bins:** 138  
**Total SKUs:** 47  
**System Status:** ✅ Fully Operational
