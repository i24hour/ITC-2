# Inventory Update from BINGO STOCK

## Summary
- **Date**: 26 November 2025
- **Source File**: `BINGO STOCK 26.11.2025.xlsx - STOCK SHEET.csv`
- **Total Records**: 716 inventory items
- **Old Data**: Cleared before import
- **New Structure**: BIN NO → SKU → BATCH → CFC format

## How to Update Inventory

### Option 1: Web Interface (Recommended)
1. Open: `https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/upload-inventory.html`
2. Select the BINGO STOCK CSV file
3. Click "Upload and Update Inventory"
4. Wait for confirmation

### Option 2: Azure Portal SQL Editor
1. Open Azure Portal → PostgreSQL → Query editor
2. Open file: `database/update-inventory.sql`
3. Copy all SQL statements
4. Paste into Query editor
5. Execute

### Option 3: Command Line (if local access available)
```bash
node generate-inventory-sql.js  # Generate SQL
node upload-bingo-direct.js     # Direct upload to PostgreSQL
```

## Data Structure

The inventory is stored in the `Bin_Inventory` table with the following columns:

| Column | Type | Description |
|--------|------|-------------|
| bin_no | VARCHAR | Bin location (A01, A02, etc.) |
| sku | VARCHAR | Product SKU code |
| batch_no | VARCHAR | Batch number (Z20NOV25 format) |
| cfc | VARCHAR | CFC value |
| description | VARCHAR | Product description |
| uom | VARCHAR | Unit of measurement |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

## Sample Data

```
Bin: A02, SKU: FXC74050S, Batch: Z20NOV25, CFC: 227
Bin: A03, SKU: FXC70010S, Batch: Z20NOV25, CFC: 180
Bin: A04, SKU: FXC70010S, Batch: Z20NOV25, CFC: 210
```

## Files Generated

1. `database/update-inventory.sql` - SQL INSERT statements (716 records)
2. `public/upload-inventory.html` - Web interface for uploading
3. `upload-bingo-direct.js` - Direct PostgreSQL upload script
4. `upload-bingo-inventory.js` - API-based upload script
5. `generate-inventory-sql.js` - SQL generation script

## Notes

⚠️ **Warning**: The update process will DELETE all existing inventory data before inserting new records.

✅ **Verification**: After updating, verify the data using:
```sql
SELECT COUNT(*) as total_records,
       COUNT(DISTINCT bin_no) as unique_bins,
       COUNT(DISTINCT sku) as unique_skus
FROM "Bin_Inventory";
```

Expected results:
- Total Records: 716
- Unique Bins: ~450+ bins
- Unique SKUs: ~50+ unique products
