# 🚀 Next Steps After GitHub Push

## Your Repository
**URL**: https://github.com/i24hour/ITC-2

Once your code is pushed to GitHub, follow these steps to deploy to Azure:

---

## 📋 Step-by-Step Azure Deployment

### Step 1: Create Personal Access Token ✅ (Do this first!)

1. Go to: https://github.com/settings/tokens/new
2. Note: "ITC-2 Deployment"
3. Scopes: ✅ repo, ✅ workflow
4. Generate and copy the token

### Step 2: Push Code to GitHub

```bash
git remote set-url origin https://YOUR-TOKEN@github.com/i24hour/ITC-2.git
git push -u origin main
```

---

### Step 3: Create Azure PostgreSQL Database (10 minutes)

1. **Go to**: https://portal.azure.com
2. **Click**: "Create a resource" → Search "Azure Database for PostgreSQL"
3. **Select**: "Flexible server" → Click "Create"

**Configuration:**
```
Basics:
├── Resource Group: itc-warehouse-rg (Create new)
├── Server name: itc-warehouse-db-2025
├── Region: Central India (or closest to you)
├── PostgreSQL version: 14
├── Workload type: Development
└── Authentication: PostgreSQL authentication

Compute + Storage:
├── Compute tier: Burstable
├── Compute size: B1ms (1 vCore, 2 GiB RAM)
└── Storage: 32 GiB

Admin Account:
├── Admin username: itcadmin (or your choice)
└── Password: [Create strong password and SAVE IT!]

Networking:
├── Connectivity method: Public access
├── Firewall rules: ✅ Allow public access from any Azure service
└── ✅ Add current client IP address
```

4. **Click**: "Review + create" → "Create"
5. **Wait**: ~5 minutes for deployment

**After deployment:**
- Go to your PostgreSQL server
- Click "Databases" → "+ Add"
- Database name: `itc_warehouse`
- Click "Save"

---

### Step 4: Create Azure Web App (5 minutes)

1. **Click**: "Create a resource" → Search "Web App"
2. **Click**: "Create"

**Configuration:**
```
Basics:
├── Resource Group: itc-warehouse-rg (same as database)
├── Name: itc-warehouse-app-2025 (must be globally unique)
├── Publish: Code
├── Runtime stack: Node 18 LTS
├── Operating System: Linux
└── Region: Central India (same as database)

App Service Plan:
├── Click "Create new"
├── Name: itc-warehouse-plan
└── Pricing plan: Basic B1 ($13/month)
    Or Free F1 for testing
```

3. **Click**: "Review + create" → "Create"
4. **Wait**: ~2 minutes

---

### Step 5: Configure Environment Variables (3 minutes)

1. **Go to**: Your Web App resource
2. **Click**: "Configuration" (under Settings)
3. **Click**: "+ New application setting" for each:

```
Name: DB_HOST
Value: itc-warehouse-db-2025.postgres.database.azure.com

Name: DB_PORT
Value: 5432

Name: DB_NAME
Value: itc_warehouse

Name: DB_USER
Value: itcadmin (your admin username)

Name: DB_PASSWORD
Value: [your database password]

Name: NODE_ENV
Value: production
```

4. **Click**: "Save" at the top
5. **Click**: "Continue" when prompted

---

### Step 6: Connect GitHub for Auto-Deployment (5 minutes)

1. **In Web App**: Click "Deployment Center" (left menu)
2. **Source**: Select "GitHub"
3. **Click**: "Authorize" and sign in to GitHub (if needed)
4. **Configure**:
   - Organization: `i24hour`
   - Repository: `ITC-2`
   - Branch: `main`
5. **Click**: "Save"

**🎉 Azure will automatically deploy your app!**

Watch the deployment in "Logs" tab. Wait ~5-10 minutes for first deployment.

---

### Step 7: Run Database Migration (3 minutes)

**Option A: Locally (Recommended)**

1. Update your local `.env` file:
```bash
DB_HOST=itc-warehouse-db-2025.postgres.database.azure.com
DB_PORT=5432
DB_NAME=itc_warehouse
DB_USER=itcadmin
DB_PASSWORD=your-password-here
```

2. Run migration:
```bash
npm run migrate
```

**Option B: Azure Cloud Shell**

1. In Azure Portal, click the Cloud Shell icon (>_) at the top
2. Select "Bash"
3. Run:
```bash
git clone https://github.com/i24hour/ITC-2.git
cd ITC-2
npm install

# Create .env file
cat > .env << EOF
DB_HOST=itc-warehouse-db-2025.postgres.database.azure.com
DB_PORT=5432
DB_NAME=itc_warehouse
DB_USER=itcadmin
DB_PASSWORD=your-password-here
EOF

# Run migration
npm run migrate
```

---

### Step 8: Test Your Live App! 🎉

1. **Get your URL**: https://itc-warehouse-app-2025.azurewebsites.net
2. **Test endpoints**:

```bash
# Health check
curl https://itc-warehouse-app-2025.azurewebsites.net/api/health

# Get SKUs
curl https://itc-warehouse-app-2025.azurewebsites.net/api/skus

# Get inventory
curl https://itc-warehouse-app-2025.azurewebsites.net/api/inventory
```

3. **Open in browser**: https://itc-warehouse-app-2025.azurewebsites.net

---

## 🔄 Future Deployments (Automatic!)

After setup, whenever you make changes:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Azure automatically:
1. ✅ Detects the push
2. ✅ Builds your app
3. ✅ Deploys to production
4. ✅ Restarts the server

**Time**: 2-5 minutes per deployment

---

## 📊 Monitor Deployment

### View Deployment Status
- Go to: Web App → Deployment Center → Logs
- See: Build and deployment progress

### View Application Logs
- Go to: Web App → Log stream
- See: Live application logs

### Check Deployment History
- Go to: Web App → Deployment Center → Logs
- See: All past deployments with status

---

## 🎯 Verification Checklist

After deployment, verify:

- [ ] Web App is running (check Overview page)
- [ ] Database connection works (check Log stream)
- [ ] `/api/health` endpoint returns healthy status
- [ ] `/api/skus` returns list of SKUs
- [ ] `/api/inventory` returns inventory data
- [ ] Main page loads in browser
- [ ] Can login and access dashboard
- [ ] QR scanning works from mobile

---

## 💰 Cost Summary

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| PostgreSQL Flexible Server | B1ms (1 vCore, 2GB) | $12 |
| App Service Plan | B1 (1 Core, 1.75GB) | $13 |
| **Total** | | **$25/month** |

**Free Alternative for Testing:**
- App Service: F1 (Free tier with limitations)
- PostgreSQL: B1ms ($12/month minimum)
- Total: $12/month

---

## 🔧 Troubleshooting

### Deployment Failed?
1. Check: Deployment Center → Logs
2. Common fixes:
   - Verify Node version is 18 LTS
   - Check all environment variables are set
   - Ensure database firewall allows Azure services

### App Not Starting?
1. Check: Web App → Log stream
2. Look for error messages
3. Verify database connection string

### Database Connection Failed?
1. PostgreSQL → Networking
2. Ensure "Allow Azure services" is enabled
3. Check credentials in Web App Configuration

### Need to Restart?
```bash
# Via Azure Portal
Web App → Overview → Restart

# Via Azure CLI
az webapp restart --name itc-warehouse-app-2025 --resource-group itc-warehouse-rg
```

---

## 🚀 Quick Commands

```bash
# View Web App logs
az webapp log tail --name itc-warehouse-app-2025 --resource-group itc-warehouse-rg

# Restart Web App
az webapp restart --name itc-warehouse-app-2025 --resource-group itc-warehouse-rg

# SSH into container
az webapp ssh --name itc-warehouse-app-2025 --resource-group itc-warehouse-rg

# View all resources
az resource list --resource-group itc-warehouse-rg --output table
```

---

## 🎉 Success!

Once everything is deployed:

✅ Your app is live at: https://itc-warehouse-app-2025.azurewebsites.net
✅ Auto-deployment from GitHub is enabled
✅ Database is set up and migrated
✅ SSL certificate is active
✅ Ready for production use!

**Share your app URL with your team and start using it!**

---

## 📱 Access Points

- **Main App**: https://itc-warehouse-app-2025.azurewebsites.net
- **GitHub Repo**: https://github.com/i24hour/ITC-2
- **Azure Portal**: https://portal.azure.com
- **API Docs**: See FRONTEND_README.md

---

## 📚 Additional Resources

- **GitHub Deployment Guide**: GITHUB_DEPLOYMENT_GUIDE.md
- **Azure Documentation**: AZURE_DEPLOYMENT.md
- **Deployment Checklist**: DEPLOYMENT_CHECKLIST.md
- **Quick Reference**: QUICK_REFERENCE.txt

---

**Need help?** Check the deployment logs or refer to the detailed guides!
