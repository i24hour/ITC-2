# 📅 Aging Column Integration Guide

## Overview

This guide explains how to add and populate the `aging_days` column in the `Cleaned_FG_Master_file` table using data from `BATCHWISE AGE ANALYSIS REPORT.XLS`.

## What Was Done

### 1. Database Schema Updated

Added `aging_days` column to `Cleaned_FG_Master_file` table:

```sql
ALTER TABLE "Cleaned_FG_Master_file"
  ADD COLUMN IF NOT EXISTS aging_days INTEGER DEFAULT NULL;
```

### 2. Files Created

#### a) `database/add-aging-column.js`

- **Purpose**: Automated script to read Excel file and update database
- **Features**:
  - Reads SKU data from Excel Column D
  - Reads aging values from Excel Column R
  - Calculates average aging for SKUs with multiple entries
  - Updates database with aging values
  - Provides detailed statistics

#### b) `database/generate-aging-sql.js`

- **Purpose**: Generates SQL script for manual execution
- **Output**: `database/update-aging-column.sql`
- **Use Case**: When database connection is unavailable

#### c) `database/update-aging-column-manual.sql`

- **Purpose**: Template SQL script
- **Contains**: Sample structure for updates

### 3. Restructure Script Updated

Updated `database/restructure.js` to include `aging_days` column by default in new installations.

## How to Use

### Option 1: Automated Script (Recommended)

```bash
node database/add-aging-column.js
```

**Requirements:**

- Active Azure database connection
- Excel file in project root
- Node.js with required packages

**Output:**

```
📖 Reading BATCHWISE AGE ANALYSIS REPORT.XLS...
✅ Processed 450 rows from Excel
✅ Found 125 unique SKUs with aging data

📊 Sample aging data (first 10 SKUs):
   FXC10005PB: 42 days
   FXC10005SLA: 6 days
   ...

✅ AGING COLUMN ADDITION COMPLETE!
📊 Statistics:
   Total SKUs in database: 150
   SKUs with aging data: 125
   SKUs updated: 125
   Average aging: 18 days
   Min aging: 5 days
   Max aging: 56 days
```

### Option 2: Generate SQL Script

```bash
node database/generate-aging-sql.js
```

Then execute the generated `database/update-aging-column.sql` in:

- Azure Portal Query Editor
- pgAdmin
- Any PostgreSQL client

### Option 3: Manual Azure Portal

1. Open Azure Portal
2. Navigate to your PostgreSQL database
3. Open Query Editor
4. Run:

```sql
-- Step 1: Add column
ALTER TABLE "Cleaned_FG_Master_file"
  ADD COLUMN IF NOT EXISTS aging_days INTEGER DEFAULT NULL;

-- Step 2: Update values (example)
UPDATE "Cleaned_FG_Master_file" SET aging_days = 42 WHERE sku = 'FXC10005PB';
UPDATE "Cleaned_FG_Master_file" SET aging_days = 6 WHERE sku = 'FXC10005SLA';
-- ... continue for all SKUs
```

## Data Mapping

| Excel Column | Database Column | Description           |
| ------------ | --------------- | --------------------- |
| Column D     | `sku`           | SKU Code (Brand code) |
| Column R     | `aging_days`    | Age in days           |

## Excel File Structure

```
Row 7: Headers (Brand code, ..., Age in days)
Row 8+: Data rows
```

**Example:**

```
Column D (SKU)    | Column R (Aging)
------------------|------------------
FXC10005PB        | 42
FXC10005SLA       | 6
FXC10010SA        | 23
```

## Verification Queries

### Check Column Exists

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Cleaned_FG_Master_file'
  AND column_name = 'aging_days';
```

### View Statistics

```sql
SELECT
  COUNT(*) as total_skus,
  COUNT(aging_days) as skus_with_aging,
  ROUND(AVG(aging_days)) as avg_aging,
  MIN(aging_days) as min_aging,
  MAX(aging_days) as max_aging
FROM "Cleaned_FG_Master_file";
```

### View Top 10 Oldest SKUs

```sql
SELECT sku, description, aging_days
FROM "Cleaned_FG_Master_file"
WHERE aging_days IS NOT NULL
ORDER BY aging_days DESC
LIMIT 10;
```

### View SKUs Without Aging Data

```sql
SELECT sku, description
FROM "Cleaned_FG_Master_file"
WHERE aging_days IS NULL;
```

## API Integration

### Get SKU with Aging

Add to your API endpoints:

```javascript
// Get SKU details with aging
app.get("/api/sku-details/:sku", async (req, res) => {
  const { sku } = req.params;
  const result = await db.query(
    `SELECT sku, description, uom, aging_days 
     FROM "Cleaned_FG_Master_file" 
     WHERE sku = $1`,
    [sku]
  );
  res.json(result.rows[0]);
});

// Get SKUs by aging threshold
app.get("/api/skus/aging/:days", async (req, res) => {
  const { days } = req.params;
  const result = await db.query(
    `SELECT sku, description, aging_days 
     FROM "Cleaned_FG_Master_file" 
     WHERE aging_days >= $1
     ORDER BY aging_days DESC`,
    [days]
  );
  res.json(result.rows);
});
```

## Frontend Display

### Show Aging in SKU Details

```javascript
// In incoming.js or outgoing.js
async function fetchAndDisplaySKUDetails(sku) {
  const response = await fetch(`/api/sku-details/${sku}`);
  const data = await response.json();

  document.getElementById("sku-description").textContent = data.description;
  document.getElementById(
    "sku-uom"
  ).textContent = `UOM: ${data.uom} kg per CFC`;

  // NEW: Display aging
  if (data.aging_days) {
    document.getElementById(
      "sku-aging"
    ).textContent = `Age: ${data.aging_days} days`;
    document.getElementById("sku-aging").style.color =
      data.aging_days > 30 ? "#f44336" : "#666";
  }
}
```

## Troubleshooting

### Issue: Database Connection Timeout

**Solution:** Use Option 2 (Generate SQL Script)

### Issue: Excel File Not Found

**Solution:** Ensure `BATCHWISE AGE ANALYSIS REPORT.XLS` is in project root

### Issue: Column Already Exists

**Solution:** Script handles this with `IF NOT EXISTS`

### Issue: SKU Not Found in Database

**Check:** SKU exists in `Cleaned_FG_Master_file` table
**Note:** Script will log SKUs not found

## Maintenance

### Update Aging Values

Run the script periodically when you receive updated Excel files:

```bash
# Backup old values (optional)
# Run update
node database/add-aging-column.js
```

### Monitor Aging

Set up alerts for SKUs exceeding age thresholds:

```sql
SELECT sku, description, aging_days
FROM "Cleaned_FG_Master_file"
WHERE aging_days > 45  -- Alert threshold
ORDER BY aging_days DESC;
```

## Notes

1. **Multiple Entries**: If a SKU appears multiple times in Excel with different aging values, the script calculates the average.

2. **NULL Values**: SKUs without aging data in Excel will have `NULL` in `aging_days` column.

3. **Data Types**: `aging_days` is stored as INTEGER (whole days).

4. **Performance**: Updating ~150 SKUs takes approximately 2-3 seconds.

## Support

For issues or questions:

1. Check console output for detailed error messages
2. Verify Excel file format matches expected structure
3. Ensure database credentials in `.env` are correct
4. Check Azure PostgreSQL firewall rules allow your IP

---

**Last Updated:** November 7, 2025
**Version:** 1.0
