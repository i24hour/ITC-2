# Operator ID Format - OP001, OP002, OP003...

## 📋 Operator ID System

### **Format Specification**
- **Pattern**: `OP` + 3-digit number padded with zeros
- **Examples**: 
  - First operator: `OP001`
  - Second operator: `OP002`
  - Tenth operator: `OP010`
  - Hundredth operator: `OP100`

### **Auto-Generation Logic**

**Location**: `server.js` - Line 162

```javascript
// Count existing operators
const countResult = await client.query(
  `SELECT COUNT(*) as count FROM "Operators"`
);
const nextNumber = parseInt(countResult.rows[0].count) + 1;

// Generate operator_id in format OP001, OP002, etc.
operatorId = `OP${String(nextNumber).padStart(3, '0')}`;
```

### **How It Works**

1. **During Signup** (`POST /api/auth/signup`):
   - System counts existing operators in database
   - Adds 1 to get next number
   - Formats as OP + 3-digit zero-padded number
   - Stores in `Operators` table

2. **During Login** (`POST /api/auth/login`):
   - Retrieves existing `operator_id` from `Operators` table
   - Uses it for session creation
   - Stores in `user_sessions` table

3. **During Task Completion**:
   - Gets `operator_id` from validated session
   - Stores in `Task_History` table with task details

---

## 📊 Database Storage

### **Operators Table**
```sql
CREATE TABLE "Operators" (
    operator_id VARCHAR(10) PRIMARY KEY,  -- Stores OP001, OP002, etc.
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(20) DEFAULT 'operator',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

### **Task_History Table**
```sql
CREATE TABLE "Task_History" (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(50),
    operator_id VARCHAR(10) NOT NULL,     -- References Operators.operator_id
    operator_name VARCHAR(100),
    task_type VARCHAR(20),                 -- 'incoming' or 'outgoing'
    sku VARCHAR(50),
    quantity INTEGER,
    bins_used TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    started_at TIMESTAMP,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_minutes INTEGER
);
```

### **user_sessions Table**
```sql
CREATE TABLE user_sessions (
    session_id SERIAL PRIMARY KEY,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(100),
    operator_id VARCHAR(255),              -- Stores operator_id from Operators table
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🎯 Dashboard Display

### **Visual Format**
The dashboard now displays operator IDs with visual highlighting:

```
┌─────────────────────────────────────────────┐
│ OP001 - John Doe                            │ ← Operator ID in BLUE
│ 📥 Incoming | SKU: SKU001 | Qty: 240 CFC   │
│ Bins Used: A01, B03, C05                    │
│ Duration: 15 minutes                        │
│ Status: ✓ completed                         │
└─────────────────────────────────────────────┘
```

### **Display Code**
**File**: `public/dashboard.js` - Lines 94-107

```javascript
// Ensure operator_id is displayed in OP00X format
const displayOperatorId = task.operator_id || 'N/A';
const displayOperatorName = task.operator_name || 'Unknown Operator';

taskItem.innerHTML = `
    <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">
        <span style="color: #2196F3;">${displayOperatorId}</span> - ${displayOperatorName}
    </div>
`;
```

**Features**:
- ✅ Operator ID displayed in **blue color (#2196F3)** for visibility
- ✅ Fallback to "N/A" if operator_id is null/undefined
- ✅ Fallback to "Unknown Operator" if operator_name is missing
- ✅ Format: `OP001 - Operator Name`

---

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. SIGNUP/LOGIN                                         │
│    User signs up → Auto-generates OP001                 │
│    Stored in: Operators.operator_id                     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. SESSION CREATION                                     │
│    Session created with operator_id                     │
│    Stored in: user_sessions.operator_id                 │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 3. TASK COMPLETION                                      │
│    Task completed → Gets operator_id from session       │
│    Stored in: Task_History.operator_id                  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 4. DASHBOARD DISPLAY                                    │
│    Fetches tasks → Shows: OP001 - John Doe             │
│    Displayed on: dashboard.html                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Troubleshooting

### **Operator ID showing as "N/A" or "undefined"**

**Possible Causes**:
1. Old task records created before operator system was implemented
2. Operator_id not stored in session during login/signup
3. Session validation failing

**Solution**:
```javascript
// Check session has operator_id
const validation = await sessions.validateSession(sessionToken);
console.log('Session operator_id:', validation.session.operator_id);

// Check Task_History records
SELECT operator_id, operator_name, COUNT(*) 
FROM "Task_History" 
GROUP BY operator_id, operator_name;
```

### **Operator ID not in OP001 format**

**Possible Causes**:
1. User logged in before Operators table existed (fallback to email)
2. Manual data entry
3. Migration from old system

**Solution**:
- Users need to sign up again to get proper OP00X ID
- Or manually update Operators table with correct format

---

## 📝 Recent Changes

**November 5, 2024** (Commit: 4b46ae9)
- ✅ Added visual highlighting (blue color) to operator_id on dashboard
- ✅ Added fallback handling for null/undefined operator_id (shows "N/A")
- ✅ Added fallback handling for missing operator_name (shows "Unknown Operator")
- ✅ Improved visual distinction between operator ID and name

---

## 🎯 Future Enhancements

Potential improvements:
1. Add operator profile page showing their ID prominently
2. Display operator_id in incoming/outgoing pages during scanning
3. Add operator_id to QR code labels for bin tracking
4. Create operator performance reports filtered by operator_id
5. Add operator_id to export reports

---

**Last Updated**: November 5, 2024  
**System Status**: ✅ Operator IDs properly formatted and displayed  
**Format**: OP001, OP002, OP003... (auto-incrementing)
