# 📋 QUICK REFERENCE: Download Cleaned_FG_Master_file

## 🎯 Your Goal

Download `Cleaned_FG_Master_file` table from Azure PostgreSQL as CSV file.

## ⚡ FASTEST METHOD (5 minutes)

### Step-by-Step:

1. **Open Browser** → https://portal.azure.com

2. **Find Database** → Search "itc-warehouse-db-2025"

3. **Open Query Editor** → Left menu → "Query editor"

4. **Login** → Use credentials from your .env file

5. **Copy-Paste This Query:**

```sql
COPY (
  SELECT sku, description, uom, aging_days, created_at
  FROM "Cleaned_FG_Master_file"
  ORDER BY sku
) TO STDOUT WITH CSV HEADER;
```

6. **Click "Run"**

7. **Copy Results** → Select all output text

8. **Save File** → Paste into text editor → Save as `Cleaned_FG_Master_file_export.csv`

## ✅ Done!

You now have your CSV file with:

- All SKU records
- Current aging_days values (if populated)
- Ready for analysis

---

## 📂 Alternative: If Azure Portal SQL Doesn't Work

Try the **visual export** in Query Editor:

```sql
SELECT * FROM "Cleaned_FG_Master_file" ORDER BY sku;
```

Then click **"Export"** button in results → Choose CSV → Download

---

## 🔍 Quick Check Before Download

```sql
-- See how many records exist
SELECT COUNT(*) FROM "Cleaned_FG_Master_file";

-- Check if aging data is populated
SELECT
  COUNT(*) as total,
  COUNT(aging_days) as with_aging,
  COUNT(*) - COUNT(aging_days) as without_aging
FROM "Cleaned_FG_Master_file";
```

---

## 📱 Contact if Issues

All related files are in: `database/` folder

- `DOWNLOAD_CLEANED_FG_MASTER_GUIDE.md` - Full guide
- `download-via-azure-portal.sql` - SQL queries
- `CONNECTION_STATUS.md` - Why connection failed
