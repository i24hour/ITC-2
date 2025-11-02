# PostgreSQL Database Migration Guide

This guide will help you migrate from Excel-based storage to PostgreSQL database.

## Prerequisites

1. **PostgreSQL Installation**
   - Download and install PostgreSQL from: https://www.postgresql.org/download/
   - For macOS: `brew install postgresql@15`
   - For Windows: Download installer from postgresql.org
   - For Linux: `sudo apt-get install postgresql postgresql-contrib`

2. **Node.js Dependencies**
   ```bash
   npm install
   ```

## Step-by-Step Setup

### 1. Start PostgreSQL Service

**macOS:**
```bash
brew services start postgresql@15
# or
pg_ctl -D /usr/local/var/postgres start
```

**Windows:**
PostgreSQL service starts automatically after installation. Check Services app.

**Linux:**
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database

Open PostgreSQL command line:
```bash
psql -U postgres
```

Create the database:
```sql
CREATE DATABASE itc_warehouse;
\q
```

Or use this one-liner:
```bash
createdb -U postgres itc_warehouse
```

### 3. Configure Environment Variables

Update the `.env` file with your PostgreSQL credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=itc_warehouse
DB_USER=postgres
DB_PASSWORD=your_password_here
PORT=3000
```

**Important:** Replace `your_password_here` with your actual PostgreSQL password.

### 4. Initialize Database Schema

Run the migration script to create tables and import Excel data:

```bash
node database/migrate.js
```

This will:
- ✅ Create all necessary tables (inventory, transactions, tasks, active_skus)
- ✅ Import data from your Excel file
- ✅ Initialize all SKUs as active
- ✅ Set up indexes for performance

### 5. Update Server Configuration

Rename your current server file (backup):
```bash
mv server.js server-excel.js
```

Use the PostgreSQL server:
```bash
mv server-postgres.js server.js
```

### 6. Start the Server

```bash
npm start
```

You should see:
```
🚀 Server running!
   Local:   http://localhost:3000
   Network: http://YOUR_IP:3000

📱 Use the Network URL to scan QR codes from your phone

✅ PostgreSQL database connected successfully
```

## Database Schema

### Tables

1. **inventory** - Stores all bin and SKU data
   - `id` - Primary key
   - `bin_no` - Bin number
   - `sku` - SKU code
   - `batch_no` - Batch number
   - `description` - Item description
   - `cfc` - Carton/Container count
   - `uom` - Unit of measurement (weight per carton)
   - `qty` - Total quantity (CFC × UOM)
   - `created_at` - Creation timestamp
   - `updated_at` - Last update timestamp

2. **transactions** - Audit log of all inventory movements
   - `id` - Primary key
   - `transaction_type` - 'incoming' or 'outgoing'
   - `bin_id` - Bin number
   - `sku` - SKU code
   - `quantity` - Number of units moved
   - `batch_no` - Batch number
   - `operator` - User who performed action
   - `previous_value` - Value before transaction
   - `new_value` - Value after transaction
   - `timestamp` - When transaction occurred

3. **tasks** - Supervisor monitoring of operator tasks
   - `id` - Primary key
   - `operator` - Operator name
   - `sku` - SKU being handled
   - `bin_no` - Bins involved
   - `quantity` - Quantity to handle
   - `task_type` - 'incoming' or 'outgoing'
   - `status` - 'ongoing', 'completed', or 'cancelled'
   - `cancel_reason` - Reason if cancelled
   - `cancelled_by` - Who cancelled it
   - `created_at` - Task start time
   - `completed_at` - Task completion time
   - `cancelled_at` - Task cancellation time

4. **active_skus** - SKU availability configuration
   - `id` - Primary key
   - `sku` - SKU code
   - `is_active` - Whether SKU is available in dropdowns
   - `created_at` - Creation timestamp
   - `updated_at` - Last update timestamp

## Useful PostgreSQL Commands

### Connect to Database
```bash
psql -U postgres -d itc_warehouse
```

### View All Tables
```sql
\dt
```

### View Table Structure
```sql
\d inventory
\d transactions
\d tasks
\d active_skus
```

### Query Examples

**View all inventory:**
```sql
SELECT * FROM inventory ORDER BY bin_no;
```

**View recent transactions:**
```sql
SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 10;
```

**View active tasks:**
```sql
SELECT * FROM tasks WHERE status = 'ongoing';
```

**View inventory summary:**
```sql
SELECT 
    sku, 
    COUNT(DISTINCT bin_no) as bins,
    SUM(cfc) as total_cartons
FROM inventory 
WHERE cfc > 0
GROUP BY sku
ORDER BY total_cartons DESC;
```

**View low stock items:**
```sql
SELECT bin_no, sku, cfc 
FROM inventory 
WHERE cfc > 0 AND cfc < 10 
ORDER BY cfc ASC;
```

## Backup and Restore

### Backup Database
```bash
pg_dump -U postgres itc_warehouse > backup.sql
```

### Restore Database
```bash
psql -U postgres itc_warehouse < backup.sql
```

### Export to CSV
```sql
\copy inventory TO '/path/to/inventory.csv' CSV HEADER;
```

## Troubleshooting

### Connection Refused
- Make sure PostgreSQL is running: `brew services list` (macOS) or `sudo systemctl status postgresql` (Linux)
- Check if PostgreSQL is listening: `psql -U postgres -c "SELECT version();"`

### Authentication Failed
- Update password in `.env` file
- Reset PostgreSQL password: `ALTER USER postgres PASSWORD 'newpassword';`

### Migration Failed
- Check Excel file path in `database/migrate.js`
- Ensure Excel file exists: `BINGO STOCK  16.10.2025.xlsx`
- Check database permissions

### Database Doesn't Exist
```bash
createdb -U postgres itc_warehouse
```

## Performance Tips

1. **Indexes** - Already created for frequently queried columns
2. **Connection Pooling** - Configured with max 20 connections
3. **Transactions** - Used for data consistency
4. **Query Optimization** - Use EXPLAIN ANALYZE for slow queries

## Migration Benefits

✅ **Better Performance** - Indexed queries, faster searches
✅ **Data Integrity** - ACID transactions, foreign keys
✅ **Audit Trail** - Complete transaction history
✅ **Scalability** - Handles large datasets efficiently
✅ **Concurrent Access** - Multiple users simultaneously
✅ **Advanced Queries** - Complex filtering and reporting
✅ **Backup & Recovery** - Professional database backup tools

## Rolling Back to Excel

If you need to roll back:

1. Stop the server
2. Rename files back:
   ```bash
   mv server.js server-postgres.js
   mv server-excel.js server.js
   ```
3. Restart the server:
   ```bash
   npm start
   ```

## Support

For issues or questions:
1. Check PostgreSQL logs: `/usr/local/var/log/postgres.log` (macOS)
2. Check server logs in terminal
3. Verify `.env` configuration
4. Ensure database migrations ran successfully
