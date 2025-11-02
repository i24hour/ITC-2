# 🚀 Quick Start Guide - PostgreSQL Migration

## What Changed?

Your ITC Warehouse system now uses **PostgreSQL database** instead of Excel file for better performance, scalability, and data integrity.

## Prerequisites

1. **PostgreSQL** must be installed on your system
2. **Node.js** and npm installed

## Quick Setup (Choose your OS)

### 🍎 macOS / Linux

1. **Install PostgreSQL** (if not already installed):
   ```bash
   # macOS
   brew install postgresql@15
   brew services start postgresql@15
   
   # Linux
   sudo apt-get install postgresql postgresql-contrib
   sudo systemctl start postgresql
   ```

2. **Run the automated setup**:
   ```bash
   chmod +x setup-postgres.sh
   ./setup-postgres.sh
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

### 🪟 Windows

1. **Install PostgreSQL**:
   - Download from: https://www.postgresql.org/download/windows/
   - Install with default settings
   - Remember your postgres password!

2. **Run the automated setup**:
   - Double-click `setup-postgres.bat`
   - OR run in Command Prompt:
   ```cmd
   setup-postgres.bat
   ```

3. **Start the server**:
   ```cmd
   npm start
   ```

## Manual Setup

If automated setup doesn't work, follow these steps:

### 1. Create Database

```bash
createdb -U postgres itc_warehouse
```

Or in psql:
```sql
CREATE DATABASE itc_warehouse;
```

### 2. Configure Environment

Edit `.env` file with your PostgreSQL credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=itc_warehouse
DB_USER=postgres
DB_PASSWORD=your_password_here
PORT=3000
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Migration

This imports your Excel data into PostgreSQL:
```bash
npm run migrate
```

### 5. Start Server

```bash
npm start
```

## Verification

When the server starts successfully, you should see:

```
🚀 Server running!
   Local:   http://localhost:3000
   Network: http://192.168.x.x:3000

📱 Use the Network URL to scan QR codes from your phone

✅ Connected to PostgreSQL database
✅ PostgreSQL database connected successfully
```

## Testing

1. Open browser: http://localhost:3000
2. Login with any credentials (demo mode)
3. Test features:
   - Dashboard statistics
   - Incoming inventory
   - Outgoing inventory (FIFO)
   - Supervisor panel
   - Reports

## What's Different?

### ✅ Improvements

1. **Better Performance**: Faster queries with database indexes
2. **Data Integrity**: ACID transactions prevent data corruption
3. **Audit Trail**: Complete transaction history in `transactions` table
4. **Concurrent Access**: Multiple users can work simultaneously
5. **Advanced Queries**: Complex filtering and reporting
6. **Professional Backup**: Use `pg_dump` for backups

### 🔄 Same Features

- All existing features work exactly the same
- Same UI and user experience
- Same QR code functionality
- Same supervisor controls
- Same FIFO logic

### 📊 New Capabilities

1. **Transaction History**: Every change is logged
2. **Better Reporting**: Query transaction data
3. **Real-time Updates**: No file locking issues
4. **Scalability**: Handles thousands of records easily

## Troubleshooting

### "Connection refused" Error

**Problem**: Cannot connect to PostgreSQL

**Solution**:
```bash
# macOS
brew services start postgresql@15

# Linux
sudo systemctl start postgresql

# Windows - Check Services app
```

### "Authentication failed" Error

**Problem**: Wrong password in `.env`

**Solution**:
1. Update `.env` with correct password
2. Or reset PostgreSQL password:
   ```sql
   psql -U postgres
   ALTER USER postgres PASSWORD 'newpassword';
   ```

### "Database does not exist" Error

**Problem**: Database not created

**Solution**:
```bash
createdb -U postgres itc_warehouse
```

### Migration Failed

**Problem**: Excel file not found or error reading

**Solution**:
1. Ensure `BINGO STOCK  16.10.2025.xlsx` exists in project root
2. Check file is not open in Excel
3. Verify file permissions

## Database Management

### View Data

```bash
# Connect to database
psql -U postgres -d itc_warehouse

# List tables
\dt

# View inventory
SELECT * FROM inventory LIMIT 10;

# View recent transactions
SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 10;

# Exit
\q
```

### Backup Database

```bash
pg_dump -U postgres itc_warehouse > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
psql -U postgres itc_warehouse < backup_20251102.sql
```

## Rolling Back to Excel

If you need to go back to Excel-based system:

```bash
# Stop the server (Ctrl+C)

# Restore old server
mv server-excel.js server.js

# Restart
npm start
```

## Need Help?

1. Check `POSTGRESQL_SETUP.md` for detailed documentation
2. Check PostgreSQL logs
3. Verify `.env` configuration
4. Ensure database is running

## Next Steps

1. ✅ Test all features thoroughly
2. ✅ Backup database regularly
3. ✅ Monitor performance
4. ✅ Train users on new system

---

**🎉 Congratulations!** Your warehouse system is now running on PostgreSQL!
