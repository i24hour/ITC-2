# Database Restructure Instructions

## 🎯 What This Does

This restructure will:
1. **Create proper bin structure:**
   - A category: 8 bins (A01-A08)
   - B & C categories: 7 bins each (B01-B07, C01-C07)
   - D-O categories: 8 bins each (D01-D08...O01-O08)
   - P category: 11 bins (P01-P11)
   - **Total: 138 bins (all initially empty)**

2. **Create SKU Master table:**
   - Extracts unique SKUs from existing data
   - Stores SKU, Description, UOM (no redundancy)
   - Creates foreign key relationships

3. **Recreate inventory table:**
   - Links to SKU Master and Bins tables
   - Starts empty
   - Ready for new data entry

## ⚠️ IMPORTANT

- **Backs up existing data** before making changes
- **Cannot be run locally** due to Azure firewall
- **Must be run on Azure** after deployment

## 🚀 How to Run

### Option 1: Azure Portal (Recommended)

1. Deploy code to Azure
2. Go to Azure Portal → App Service → `itc-warehouse-app-2025`
3. Go to **SSH** or **Console**
4. Run: `npm run restructure`
5. Wait for completion (~2-3 minutes)

### Option 2: Azure CLI

```bash
az webapp ssh --name itc-warehouse-app-2025 --resource-group your-resource-group
cd /home/site/wwwroot
npm run restructure
```

## 📊 Expected Output

```
🚀 Database Restructure Script for Azure Deployment

Starting restructure...
Found 47 SKUs
✅ Restructure complete: 138 bins, 47 SKUs
```

## ✅ After Restructure

The database will have:
- ✓ 138 bins (A01-P11, all empty)
- ✓ 47 unique SKUs with descriptions and UOM
- ✓ Empty inventory table ready for use
- ✓ All foreign keys and indexes configured
- ✓ Backup of old data preserved

## 🔄 Reverting

If needed, old data is backed up in:
- `inventory_backup_[timestamp]` table
- `transactions_backup_[timestamp]` table

Contact admin to restore from backup if needed.
