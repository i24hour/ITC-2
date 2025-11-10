# 🚨 DATABASE CONNECTION STATUS

## Current Issue

**Azure PostgreSQL connection is timing out** when trying to download `Cleaned_FG_Master_file` table.

## Error Details

```
Connection Timeout: 2000ms (too short for Azure)
Database: itc-warehouse-db-2025.postgres.database.azure.com:5432/itc_warehouse
```

## Why This Happens

1. **Firewall Restrictions**: Your IP address may not be whitelisted
2. **Network Issues**: VPN or corporate firewall blocking connection
3. **Connection Timeout**: 2-second timeout is too short for cloud databases

## ✅ RECOMMENDED SOLUTION

### Use Azure Portal (5 minutes, easiest!)

1. **Open Azure Portal**

   ```
   https://portal.azure.com
   ```

2. **Navigate to your database**

   - Search for: `itc-warehouse-db-2025`
   - Click on your PostgreSQL server

3. **Open Query Editor**

   - Click "Query editor" in left menu
   - Login with your credentials from .env file

4. **Run the export SQL**

   ```sql
   COPY (
     SELECT sku, description, uom, aging_days, created_at
     FROM "Cleaned_FG_Master_file"
     ORDER BY sku
   ) TO STDOUT WITH (FORMAT CSV, HEADER true);
   ```

5. **Save Results**
   - Copy all output
   - Save as: `Cleaned_FG_Master_file_export.csv`

## 📁 Files Created

| File                                           | Purpose                         | Status           |
| ---------------------------------------------- | ------------------------------- | ---------------- |
| `database/download-cleaned-fg-master.js`       | Node.js download script         | ❌ Can't connect |
| `database/download-via-azure-portal.sql`       | Azure Portal SQL query          | ✅ Ready to use  |
| `database/DOWNLOAD_CLEANED_FG_MASTER_GUIDE.md` | Complete guide with all options | ✅ Reference     |

## 🔧 Alternative: Fix Connection

If you want to use the Node.js script later:

1. **Whitelist IP in Azure**

   - Azure Portal → PostgreSQL Server
   - Connection Security → Firewall Rules
   - Add your current IP address

2. **Increase Timeout**

   - Already increased to 10 seconds in download script
   - But 2 seconds in main db.js (used by server)

3. **Run Script Again**
   ```bash
   node database/download-cleaned-fg-master.js
   ```

## 📊 What You'll Get

**CSV Format:**

```csv
SKU,Description,UOM,Aging Days,Created At
SKU001,Product Name 1,PCS,45,2024-01-01T00:00:00.000Z
SKU002,Product Name 2,KG,30,2024-01-02T00:00:00.000Z
...
```

**Expected Columns:**

- SKU (Text)
- Description (Text)
- UOM (Unit of Measurement)
- Aging Days (Integer, may be NULL if not populated)
- Created At (Timestamp)

## 🎯 Next Steps After Download

1. ✅ Verify CSV downloaded successfully
2. ✅ Check if `aging_days` column has data
3. ⏳ If empty, populate using aging scripts (see AGING_COLUMN_GUIDE.md)
4. ⏳ Re-download to verify aging data

## 📞 Need Help?

All files and documentation are in:

```
/Users/priyanshu/Desktop/Desktop/Github/ITC-2-1/database/
```

- DOWNLOAD_CLEANED_FG_MASTER_GUIDE.md - Complete download guide
- download-via-azure-portal.sql - Ready-to-use SQL
- AGING_COLUMN_GUIDE.md - How to populate aging data
