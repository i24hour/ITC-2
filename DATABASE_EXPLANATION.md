# 🗄️ ITC Warehouse Database - Complete Explanation

## Database Overview
The ITC Warehouse Management System uses **PostgreSQL** with **8 main tables** to manage inventory, track operations, and handle user authentication.

---

## 📊 Database Tables & Their Purpose

### 1️⃣ **Cleaned_FG_Master_file** (SKU Master Data)
**Purpose:** Central repository of all product (SKU) information

**Columns:**
- `sku` (VARCHAR 50) - Primary Key - Unique product code (e.g., "210001")
- `description` (TEXT) - Product name/description (e.g., "BINGO TEDHE MEDHE 60G")
- `uom` (DECIMAL) - Unit of Measurement - Weight per carton in kg (e.g., 10.5)
- `aging_days` (INTEGER) - Product shelf life in days (optional)
- `created_at` (TIMESTAMP) - When SKU was added to system

**Usage:**
- ✅ **Lookup table** for SKU validation during incoming/outgoing operations
- ✅ **Reference data** for description and UOM when scanning products
- ✅ **Foreign Key** for Inventory, Incoming, Outgoing, Task_History tables
- ✅ Prevents invalid SKUs from being entered into the system

**Example Data:**
```
SKU     | Description              | UOM (kg/carton)
------------------------------------------------------
210001  | BINGO TEDHE MEDHE 60G   | 10.5
210002  | BINGO MAD ANGLES 72.5G  | 9.5
210003  | BINGO YUMITOS 26G       | 12.0
```

---

### 2️⃣ **Inventory** (Current Stock in Bins)
**Purpose:** Real-time snapshot of what's currently in each bin

**Columns:**
- `id` (SERIAL) - Primary Key - Auto-increment ID
- `bin_no` (VARCHAR 50) - Bin location (e.g., "A01", "D05")
- `sku` (VARCHAR 50) - Product code (Foreign Key → Cleaned_FG_Master_file)
- `batch_no` (VARCHAR 100) - Batch identifier (e.g., "Z05NOV25")
- `cfc` (INTEGER) - Current Filled Count - Number of cartons in bin
- `description` (TEXT) - Product description (copied from SKU master)
- `uom` (DECIMAL) - Weight per carton (copied from SKU master)
- `weight` (DECIMAL) - Total weight in bin (cfc × uom)
- `created_at` (TIMESTAMP) - When item first added to this bin
- `updated_at` (TIMESTAMP) - Last modification time

**Unique Constraint:** (bin_no, sku) - One SKU per bin

**Usage:**
- ✅ **Current state** - Shows what's in warehouse RIGHT NOW
- ✅ **Bin status** - If cfc = 0, bin is empty; if cfc > 0, bin is occupied
- ✅ **Stock reports** - "Current Inventory" report queries this table
- ✅ **Updated on:**
  - Incoming operations → cfc increases
  - Outgoing/dispatch → cfc decreases
  - When cfc reaches 0, record remains but bin shows as empty

**Example Data:**
```
Bin  | SKU    | Batch    | CFC | Description           | Weight
-------------------------------------------------------------------
A01  | 210001 | Z30NOV25 | 50  | BINGO TEDHE MEDHE 60G | 525.0
D05  | 210002 | Z29NOV25 | 30  | BINGO MAD ANGLES      | 285.0
```

---

### 3️⃣ **Incoming** (Incoming Transaction Log)
**Purpose:** Historical log of all items received into warehouse

**Columns:**
- `id` (SERIAL) - Primary Key - Transaction ID
- `sku` (VARCHAR 50) - Product code (Foreign Key → Cleaned_FG_Master_file)
- `batch_no` (VARCHAR 100) - Batch identifier
- `description` (TEXT) - Product description
- `weight` (DECIMAL) - Weight of this transaction
- `uom` (DECIMAL) - Weight per carton
- `cfc` (INTEGER) - Quantity received in this transaction
- `bin_no` (VARCHAR 50) - Which bin items were placed in
- `operator_id` (VARCHAR 10) - Who performed the operation (optional)
- `incoming_date` (TIMESTAMP) - When items were received

**Usage:**
- ✅ **Transaction history** - Permanent record of all incoming goods
- ✅ **Audit trail** - Who received what, when, and where
- ✅ **Reports** - "Incoming" report shows data from this table
- ✅ **Filter by date** - Today/Week/Month filters for reports
- ✅ **Inserted when:**
  - Scanning items into bins (incoming.html)
  - Updating bin quantities via /api/bins/update

**Example Data:**
```
ID  | SKU    | Batch    | CFC | Bin | Operator | Date
------------------------------------------------------------
1   | 210001 | Z30NOV25 | 50  | A01 | OP001    | 2025-11-30 10:30
2   | 210002 | Z30NOV25 | 30  | D05 | OP002    | 2025-11-30 11:15
```

---

### 4️⃣ **Outgoing** (Outgoing/Dispatch Transaction Log)
**Purpose:** Historical log of all items dispatched from warehouse

**Columns:**
- `id` (SERIAL) - Primary Key - Transaction ID
- `sku` (VARCHAR 50) - Product code (Foreign Key → Cleaned_FG_Master_file)
- `batch_no` (VARCHAR 100) - Batch identifier
- `description` (TEXT) - Product description
- `weight` (DECIMAL) - Weight dispatched
- `uom` (DECIMAL) - Weight per carton
- `cfc` (INTEGER) - Quantity dispatched in this transaction
- `bin_no` (VARCHAR 50) - Which bin items were taken from
- `operator_id` (VARCHAR 10) - Who performed the operation (optional)
- `dod` (TIMESTAMP) - Date of Dispatch

**Usage:**
- ✅ **Dispatch history** - Permanent record of all outgoing goods
- ✅ **Audit trail** - Who dispatched what, when, from where
- ✅ **Reports** - "Outgoing" report shows data from this table
- ✅ **Filter by date** - Today/Week/Month filters for reports
- ✅ **Inserted when:**
  - Scanning items out (outgoing.html)
  - Dispatching via /api/bins/dispatch or /api/bins/scan-deduct

**Example Data:**
```
ID  | SKU    | Batch    | CFC | Bin | Operator | Date
------------------------------------------------------------
1   | 210001 | Z30NOV25 | 20  | A01 | OP001    | 2025-11-30 14:30
2   | 210002 | Z29NOV25 | 10  | D05 | OP003    | 2025-11-30 15:00
```

---

### 5️⃣ **Bins** (Bin Master Data)
**Purpose:** Master list of all physical bin locations in warehouse

**Columns:**
- `bin_no` (VARCHAR 50) - Primary Key - Bin identifier (e.g., "A01", "D05", "P11")
- `category` (CHAR 1) - Section letter (A, B, C, D...P)
- `capacity` (INTEGER) - Maximum cartons bin can hold (default 240)
- `status` (VARCHAR 20) - Current status: 'empty' or 'occupied'
- `created_at` (TIMESTAMP) - When bin was created

**Bin Layout:**
- A section: A01 to A08 (8 bins)
- B section: B01 to B07 (7 bins)
- C section: C01 to C07 (7 bins)
- D-O sections: D01-D08, E01-E08... O01-O08 (12 sections × 8 = 96 bins)
- P section: P01 to P11 (11 bins)

**Total:** 129 bins

**Usage:**
- ✅ **Bin validation** - Ensures scanned bins exist
- ✅ **Capacity tracking** - Prevent overfilling (though not strictly enforced)
- ✅ **Status management** - Shows which bins are empty/occupied
- ✅ **Foreign Key** for Inventory, Incoming, Outgoing tables

**Example Data:**
```
Bin  | Category | Capacity | Status
----------------------------------------
A01  | A        | 240      | occupied
A02  | A        | 240      | empty
D05  | D        | 240      | occupied
```

---

### 6️⃣ **Operators** (Warehouse Staff)
**Purpose:** Store operator/worker accounts for authentication

**Columns:**
- `operator_id` (VARCHAR 10) - Primary Key - Unique operator code (e.g., "OP001")
- `name` (VARCHAR 100) - Full name
- `email` (VARCHAR 100) - Email address (UNIQUE)
- `password_hash` (VARCHAR 255) - Hashed password
- `role` (VARCHAR 20) - User role: 'operator', 'admin', or 'supervisor'
- `created_at` (TIMESTAMP) - Account creation date
- `last_login` (TIMESTAMP) - Last login time

**Usage:**
- ✅ **Authentication** - Login credentials for warehouse operators
- ✅ **Role-based access** - Different permissions for operators/supervisors/admins
- ✅ **Audit trail** - Links transactions to specific operators
- ✅ **Task tracking** - Foreign Key for Task_History table

**Auto-Detection:**
- If email contains "supervisor" → role = 'supervisor'
- Otherwise → role = 'operator'

**Example Data:**
```
ID    | Name           | Email               | Role
-------------------------------------------------------
OP001 | John Worker    | john@itc.com       | operator
OP002 | Jane Manager   | jane.supervisor@   | supervisor
```

---

### 7️⃣ **Supervisors** (Supervisor Accounts)
**Purpose:** Separate table for supervisor-level accounts (legacy)

**Columns:**
- `supervisor_id` (VARCHAR 10) - Primary Key (e.g., "SUP001")
- `name` (VARCHAR 100) - Full name
- `email` (VARCHAR 100) - Email address (UNIQUE)
- `password_hash` (VARCHAR 255) - Hashed password
- `phone` (VARCHAR 20) - Contact number
- `created_at` (TIMESTAMP) - Account creation date
- `last_login` (TIMESTAMP) - Last login time

**Default Account:**
- Email: supervisor@itc.com
- Password: supervisor123

**Note:** This table is mostly **legacy**. New system uses `Operators` table with role='supervisor'.

---

### 8️⃣ **Task_History** (Operator Task Tracking)
**Purpose:** Log of all tasks/operations performed by operators

**Columns:**
- `id` (SERIAL) - Primary Key
- `task_id` (INTEGER) - Task identifier (optional)
- `operator_id` (VARCHAR 10) - Who performed task (Foreign Key → Operators)
- `operator_name` (VARCHAR 100) - Operator's name
- `task_type` (VARCHAR 20) - Type: 'incoming', 'outgoing', 'dispatch', etc.
- `sku` (VARCHAR 50) - Product involved (Foreign Key → Cleaned_FG_Master_file)
- `quantity` (INTEGER) - Number of cartons handled
- `bins_used` (TEXT) - Comma-separated list of bins
- `status` (VARCHAR 20) - Task status (default: 'completed')
- `started_at` (TIMESTAMP) - When task began
- `completed_at` (TIMESTAMP) - When task finished
- `duration_minutes` (INTEGER) - Time taken to complete

**Usage:**
- ✅ **Performance tracking** - Monitor operator productivity
- ✅ **Audit trail** - Who did what and when
- ✅ **Analytics** - Generate reports on operator activity
- ✅ **Quality control** - Review completed tasks

**Example Data:**
```
ID | Operator | Task Type | SKU    | Qty | Bins      | Duration
--------------------------------------------------------------------
1  | OP001    | incoming  | 210001 | 50  | A01       | 15 min
2  | OP002    | outgoing  | 210002 | 20  | D05       | 10 min
```

---

## 🔄 Data Flow Between Tables

### **Incoming Operation Flow:**
1. Operator scans bin (validates against `Bins` table)
2. Operator scans SKU (validates against `Cleaned_FG_Master_file`)
3. System creates/updates record in `Inventory` table:
   - If bin+SKU exists → UPDATE cfc += quantity
   - If new → INSERT new record
4. System logs transaction in `Incoming` table
5. System may log task in `Task_History` table
6. Bin status updated in `Bins` table (status = 'occupied')

### **Outgoing Operation Flow:**
1. Operator scans bin (validates against `Bins` table)
2. Operator scans SKU (validates against `Cleaned_FG_Master_file`)
3. System updates `Inventory` table:
   - UPDATE cfc -= quantity
   - If cfc reaches 0 → bin becomes empty (but record remains)
4. System logs transaction in `Outgoing` table
5. System may log task in `Task_History` table
6. If bin empty → Bin status updated in `Bins` table (status = 'empty')

### **Reports Data Sources:**
- **Incoming Report** → Queries `Incoming` table
- **Outgoing Report** → Queries `Outgoing` table
- **Current Inventory Report** → Queries `Inventory` table (WHERE cfc > 0)
- **Dashboard Summary** → Aggregates from all tables

---

## 🔑 Foreign Key Relationships

```
Cleaned_FG_Master_file (sku)
    ↓
    ├── Inventory (sku)
    ├── Incoming (sku)
    ├── Outgoing (sku)
    └── Task_History (sku)

Bins (bin_no)
    ↓
    ├── Inventory (bin_no)
    ├── Incoming (bin_no)
    └── Outgoing (bin_no)

Operators (operator_id)
    ↓
    └── Task_History (operator_id)
```

---

## 📈 Table Size & Performance

**Expected Data Volumes:**
- `Cleaned_FG_Master_file`: ~50-100 SKUs (small, static)
- `Bins`: 129 bins (small, static)
- `Operators`: ~10-50 users (small, grows slowly)
- `Supervisors`: ~1-5 users (very small)
- `Inventory`: ~500-2000 records (medium, dynamic - one per occupied bin+SKU combo)
- `Incoming`: Grows continuously (1000s of transactions)
- `Outgoing`: Grows continuously (1000s of transactions)
- `Task_History`: Grows continuously (1000s of tasks)

**Performance Optimizations:**
- Primary keys on all ID columns
- Unique constraints on (bin_no, sku) in Inventory
- Indexes on frequently queried columns (sku, bin_no, dates)
- Date range filters in reports (LIMIT 100-200 records)

---

## 🛠️ Database Maintenance

**Regular Tasks:**
1. **Backup** - Use `/api/admin/export-database` to download all data
2. **Clear old logs** - Periodically archive/delete old Incoming/Outgoing/Task_History records
3. **Empty inventory** - Use `/api/admin/empty-inventory` to reset Inventory table
4. **Verify integrity** - Check foreign key relationships remain valid

**Initial Setup:**
- Run `node database/restructure.js` to create all 8 tables
- Populates Bins, Cleaned_FG_Master_file, and default Supervisor
- All other tables start empty

---

## 📝 Summary

**Static/Reference Tables** (rarely change):
- Cleaned_FG_Master_file (SKU catalog)
- Bins (bin locations)
- Operators (user accounts)
- Supervisors (supervisor accounts)

**Dynamic/Transactional Tables** (constantly updated):
- Inventory (current stock - updated on every operation)
- Incoming (transaction log - grows with each incoming)
- Outgoing (transaction log - grows with each outgoing)
- Task_History (activity log - grows with each task)

**The 3-Table Pattern:**
1. **Inventory** = Current state (what's in warehouse NOW)
2. **Incoming** = History of additions (audit trail)
3. **Outgoing** = History of removals (audit trail)

This design ensures:
✅ Fast lookups (current inventory)
✅ Complete audit trail (all transactions logged)
✅ Data integrity (foreign keys prevent invalid data)
✅ Scalability (optimized indexes and queries)
