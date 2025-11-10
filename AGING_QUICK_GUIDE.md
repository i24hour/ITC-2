# 🎯 AGING COLUMN - COMPLETE GUIDE

## ✅ What Was Done

1. **API Endpoint Created**: `/api/admin/populate-aging`

   - Reads Excel file: `BATCHWISE AGE ANALYSIS REPORT.XLS`
   - Extracts SKU (Column D) and Aging (Column R)
   - Adds `aging_days` column to database
   - Updates all SKUs with average aging values

2. **Web Interface Created**: `populate-aging.html`

   - Beautiful UI with one-click operation
   - Shows real-time statistics
   - Displays total SKUs, updated count, average aging

3. **CSV Download Pages**:
   - `download-csv.html` - Easy CSV export interface
   - Direct API: `/api/admin/export-table/Cleaned_FG_Master_file`

---

## 🚀 HOW TO USE (After Deployment)

### Step 1: Wait for Deployment

Azure will automatically deploy in 2-3 minutes after git push.

### Step 2: Populate Aging Data

Open this URL in browser:

```
https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/populate-aging.html
```

Click **"Populate Aging Data"** button.

### Step 3: Download Updated CSV

Open this URL to download:

```
https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/download-csv.html
```

Or direct download:

```
https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/api/admin/export-table/Cleaned_FG_Master_file
```

---

## 📊 What You'll Get

### In Database:

- New column: `aging_days` (INTEGER)
- Populated with average aging for each SKU
- Example: SKU "FXC10005PB" → 45 days

### In CSV:

```csv
SKU,Description,UOM,Aging Days,Created At
FXC10005PB,48560 BINGO! CHIPS RS.5 SALTED,PCS,45,2025-11-04T12:51:47.558Z
```

---

## 🔍 Verify It Worked

After clicking "Populate Aging Data", you'll see:

- ✅ Total SKUs in database
- ✅ SKUs with aging data
- ✅ Number of SKUs updated
- ✅ Average aging (in days)

---

## ⚡ Quick Commands

### Check Deployment Status

Visit: https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/api/health

### Populate Aging (API)

```bash
curl -X POST https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/api/admin/populate-aging
```

### Download CSV (Direct)

```bash
curl -o cleaned_fg_master.csv "https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/api/admin/export-table/Cleaned_FG_Master_file"
```

---

## 📝 Files Modified

1. `server.js` - Added `/api/admin/populate-aging` endpoint
2. `public/populate-aging.html` - Web interface for aging population
3. `public/download-csv.html` - Web interface for CSV download
4. `database/add-aging-column.js` - Script with improved timeout
5. `database/download-cleaned-fg-master.js` - Script with better error handling
6. `database/download-csv.py` - Python alternative for download
7. `database/add-aging-direct.sql` - Manual SQL commands
8. `database/download-via-azure-portal.sql` - Azure Portal instructions

---

## 🎉 ALL DONE!

Wait 2-3 minutes for Azure deployment, then:

1. Open: `populate-aging.html` → Click button
2. Open: `download-csv.html` → Download file
3. Check CSV - aging_days column should be populated! ✅

**Your Excel file "BATCHWISE AGE ANALYSIS REPORT.XLS" is already in the codebase, so it will work automatically!** 🚀
