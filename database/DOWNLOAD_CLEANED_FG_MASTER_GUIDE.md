# 📥 Cleaned_FG_Master_file CSV Download Guide

## 🚨 Current Issue

Azure PostgreSQL connection is timing out. This is likely due to:

- IP address not whitelisted in Azure firewall
- VPN/Network restrictions
- Azure server temporarily unavailable

## ✅ Solution Options

### Option 1: Azure Portal Query Editor (RECOMMENDED)

1. **Login to Azure Portal**

   - Go to https://portal.azure.com
   - Navigate to your PostgreSQL server: `itc-warehouse-db-2025`

2. **Open Query Editor**

   - Click on "Query editor" in the left sidebar
   - Login with your database credentials

3. **Run Export Query**

   ```sql
   COPY (
     SELECT sku, description, uom, aging_days, created_at
     FROM "Cleaned_FG_Master_file"
     ORDER BY sku
   ) TO STDOUT WITH CSV HEADER;
   ```

4. **Save Results**
   - Copy the output
   - Paste into a text file
   - Save as `Cleaned_FG_Master_file_export.csv`

### Option 2: Fix Azure Firewall

1. **Whitelist Your IP**

   - Azure Portal → PostgreSQL Server → Connection Security
   - Add your current IP address
   - Click "Save"

2. **Run Download Script Again**
   ```bash
   node database/download-cleaned-fg-master.js
   ```

### Option 3: Use pgAdmin / DBeaver

1. **Install Client**

   - pgAdmin: https://www.pgadmin.org/download/
   - DBeaver: https://dbeaver.io/download/

2. **Connection Details**

   ```
   Host: itc-warehouse-db-2025.postgres.database.azure.com
   Port: 5432
   Database: itc_warehouse
   User: [from .env]
   Password: [from .env]
   SSL: Required
   ```

3. **Export Query**
   ```sql
   SELECT sku, description, uom, aging_days, created_at
   FROM "Cleaned_FG_Master_file"
   ORDER BY sku;
   ```
4. **Export Results** → Choose CSV format

### Option 4: Azure CLI

```bash
# Install Azure CLI if not installed
brew install azure-cli

# Login
az login

# Export data
az postgres flexible-server execute \
  --name itc-warehouse-db-2025 \
  --admin-user your_username \
  --database-name itc_warehouse \
  --query-text "COPY (SELECT sku, description, uom, aging_days, created_at FROM \"Cleaned_FG_Master_file\" ORDER BY sku) TO STDOUT WITH CSV HEADER;" \
  > Cleaned_FG_Master_file_export.csv
```

## 📊 Expected CSV Format

```csv
SKU,Description,UOM,Aging Days,Created At
SKU001,Product Description 1,PCS,45,2024-01-01T00:00:00.000Z
SKU002,Product Description 2,KG,30,2024-01-02T00:00:00.000Z
...
```

## 🔍 Verify Download

After getting the CSV, verify:

- ✅ File has header row
- ✅ All SKUs are present
- ✅ Aging Days column exists (may be empty if not populated yet)
- ✅ No data corruption

## 📝 Next Steps After Download

1. ✅ Review current data structure
2. ✅ Verify SKU format matches Excel file
3. ⏳ Populate aging_days column (see AGING_COLUMN_GUIDE.md)
4. ⏳ Re-download to verify aging data
