# 🎯 GitHub to Azure Deployment - Visual Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR LOCAL MACHINE                          │
│                                                                 │
│  ✅ Step 1: DONE - Code committed                              │
│     cd /Users/priyanshu/Desktop/Github/ITC-2                   │
│     git init                                                    │
│     git add .                                                   │
│     git commit -m "Initial commit"                             │
│                                                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ git push
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         GITHUB                                  │
│                   github.com/YOUR-USERNAME/ITC-2                │
│                                                                 │
│  📍 Step 1b: TO DO NOW                                          │
│     1. Go to: https://github.com/new                           │
│     2. Create repository: ITC-2                                │
│     3. Push code:                                              │
│        git remote add origin https://github.com/YOU/ITC-2.git  │
│        git branch -M main                                      │
│        git push -u origin main                                 │
│                                                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ Auto-deployment (after Step 4)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AZURE PORTAL                               │
│                   portal.azure.com                              │
│                                                                 │
│  📍 Step 2: Create Resources                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ A. PostgreSQL Flexible Server                           │   │
│  │    Name: itc-warehouse-db-2025                          │   │
│  │    Region: Central India                                │   │
│  │    Version: PostgreSQL 14                               │   │
│  │    Tier: Burstable B1ms ($12/month)                     │   │
│  │    Database: itc_warehouse                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ B. App Service (Web App)                                │   │
│  │    Name: itc-warehouse-app-2025                         │   │
│  │    Runtime: Node 18 LTS                                 │   │
│  │    OS: Linux                                            │   │
│  │    Tier: Basic B1 ($13/month)                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📍 Step 3: Configuration → Application Settings               │
│     DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD           │
│                                                                 │
│  📍 Step 4: Deployment Center                                  │
│     • Source: GitHub                                           │
│     • Repository: ITC-2                                        │
│     • Branch: main                                             │
│     ✨ Auto-deployment enabled!                                │
│                                                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ Migration
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATABASE SETUP                                │
│                                                                 │
│  📍 Step 5: Run Migration (Choose one)                         │
│                                                                 │
│  Option A: Local Machine                                       │
│     1. Update .env with Azure DB credentials                   │
│     2. npm run migrate                                         │
│                                                                 │
│  Option B: Azure Cloud Shell                                   │
│     1. Click >_ icon in Azure Portal                           │
│     2. git clone https://github.com/YOU/ITC-2.git              │
│     3. cd ITC-2 && npm install                                 │
│     4. Create .env with Azure credentials                      │
│     5. npm run migrate                                         │
│                                                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    🎉 LIVE APPLICATION 🎉                       │
│                                                                 │
│  Your app is running at:                                       │
│  https://itc-warehouse-app-2025.azurewebsites.net              │
│                                                                 │
│  📍 Step 6: Test                                                │
│  • Open URL in browser                                         │
│  • Test API: /api/health, /api/skus                            │
│  • Use QR scanning from mobile                                 │
│                                                                 │
│  ✨ Future deployments are automatic!                           │
│     Just push to GitHub: git push origin main                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Quick Checklist

- [x] ✅ Code committed locally
- [ ] Create GitHub repository at https://github.com/new
- [ ] Push code to GitHub
- [ ] Create Azure PostgreSQL database
- [ ] Create Azure Web App
- [ ] Configure environment variables
- [ ] Connect GitHub to Azure (Deployment Center)
- [ ] Run database migration
- [ ] Test live application

---

## 🚀 What Happens After Setup?

Every time you make changes:

```bash
# Make changes to your code
git add .
git commit -m "Added new feature"
git push origin main
```

Azure automatically:

1. ✅ Detects the push within seconds
2. ✅ Downloads your code from GitHub
3. ✅ Installs dependencies (npm install)
4. ✅ Builds your application
5. ✅ Deploys to App Service
6. ✅ Restarts the server
7. ✅ Your changes are LIVE! (2-5 minutes total)

---

## 💰 Monthly Cost Breakdown

| What                | Where          | Cost          |
| ------------------- | -------------- | ------------- |
| PostgreSQL Database | Azure          | $12/month     |
| Web App Hosting     | Azure          | $13/month     |
| GitHub Repository   | GitHub         | Free          |
| SSL Certificate     | Azure          | Free          |
| Auto-deployment     | GitHub + Azure | Free          |
| **Total**           |                | **$25/month** |

💡 **Free Alternative for Testing:**

- Use Azure Free Tier (F1) for Web App: $0/month
- PostgreSQL B1ms: $12/month (minimum)
- **Total: $12/month**

---

## 🔗 Important URLs

**Create GitHub Repo:**
https://github.com/new

**Azure Portal:**
https://portal.azure.com

**After Deployment:**

- Your App: `https://itc-warehouse-app-2025.azurewebsites.net`
- GitHub Repo: `https://github.com/YOUR-USERNAME/ITC-2`

---

## 📚 Documentation Files

- **This File**: Visual flow and checklist
- **GITHUB_DEPLOYMENT_GUIDE.md**: Detailed step-by-step guide
- **AZURE_DEPLOYMENT.md**: Alternative deployment methods
- **DEPLOYMENT_CHECKLIST.md**: Printable checklist

---

## 🆘 Need Help?

**Stuck on Step 1 (GitHub)?**

- Go to: https://github.com/new
- Follow the instructions shown after creating repository

**Stuck on Step 2 (Azure)?**

- Read: GITHUB_DEPLOYMENT_GUIDE.md
- Screenshots available in Azure Portal help section

**Deployment Failed?**

- Check: Web App → Deployment Center → Logs
- View: Web App → Log stream

**Questions?**

- Azure Support: https://azure.microsoft.com/support/
- GitHub Help: https://docs.github.com

---

**🎯 Current Status: Ready for GitHub push!**

**Next Action: Create GitHub repository at https://github.com/new**
