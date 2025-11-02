# 🚀 Deploy to Azure via GitHub - Complete Guide

## Overview

This guide shows you how to deploy your ITC Warehouse System to Azure using GitHub integration. This is the **easiest method** with automatic deployments!

---

## 📋 Prerequisites

- ✅ GitHub account (free at https://github.com)
- ✅ Azure account (free at https://azure.microsoft.com/free/)
- ✅ Your code (already ready!)

---

## 🎯 Deployment Steps

### Step 1: Initialize Git and Push to GitHub

```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit - Ready for Azure deployment"

# Create repository on GitHub (go to https://github.com/new)
# Name it: ITC-2 (or any name you prefer)
# Keep it Private or Public

# Add GitHub remote (replace YOUR-USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR-USERNAME/ITC-2.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**✨ Your code is now on GitHub!**

---

### Step 2: Create Azure Resources via Portal

1. **Go to Azure Portal**: https://portal.azure.com
2. **Sign in** with your Azure account

#### A. Create PostgreSQL Database

1. Click **"Create a resource"**
2. Search for **"Azure Database for PostgreSQL"**
3. Select **"Flexible server"** → Click **"Create"**
4. Configure:
   - **Resource Group**: Create new → Name it `itc-warehouse-rg`
   - **Server name**: `itc-warehouse-db-2025` (must be unique globally)
   - **Region**: `Central India` (or closest to you)
   - **PostgreSQL version**: `14`
   - **Workload type**: `Development` (for testing) or `Production`
   - **Compute + Storage**: `Burstable, B1ms` (1 vCore, 2GB RAM) - $12/month
   - **Admin username**: Choose a username (e.g., `itcadmin`)
   - **Password**: Create a strong password **and save it!**
   - **Networking**: 
     - Select **"Allow public access from any Azure service"**
     - Add your current IP address
5. Click **"Review + create"** → **"Create"**
6. Wait ~5 minutes for deployment

#### B. Create Database

After PostgreSQL server is ready:
1. Go to your PostgreSQL server resource
2. Click **"Databases"** in the left menu
3. Click **"+ Add"**
4. Database name: `itc_warehouse`
5. Click **"Save"**

#### C. Create Web App

1. Click **"Create a resource"**
2. Search for **"Web App"**
3. Click **"Create"**
4. Configure:
   - **Resource Group**: Select `itc-warehouse-rg` (same as database)
   - **Name**: `itc-warehouse-app-2025` (must be unique globally)
   - **Publish**: `Code`
   - **Runtime stack**: `Node 18 LTS`
   - **Operating System**: `Linux`
   - **Region**: Same as database (`Central India`)
   - **Pricing Plan**: 
     - Click **"Create new"**
     - Choose **"Basic B1"** ($13/month) or **"Free F1"** (free but limited)
5. Click **"Review + create"** → **"Create"**
6. Wait ~2 minutes for deployment

---

### Step 3: Configure Web App Settings

1. Go to your **Web App** resource
2. Click **"Configuration"** in the left menu under Settings
3. Click **"+ New application setting"** to add each:

   ```
   DB_HOST = itc-warehouse-db-2025.postgres.database.azure.com
   DB_PORT = 5432
   DB_NAME = itc_warehouse
   DB_USER = itcadmin
   DB_PASSWORD = your-database-password
   NODE_ENV = production
   ```

4. Click **"Save"** at the top
5. Click **"Continue"** when prompted

---

### Step 4: Connect GitHub for Auto-Deployment

1. In your **Web App**, click **"Deployment Center"** (left menu)
2. **Source**: Select **"GitHub"**
3. Click **"Authorize"** and sign in to GitHub
4. Configure:
   - **Organization**: Your GitHub username
   - **Repository**: `ITC-2`
   - **Branch**: `main`
5. Click **"Save"** at the top

**✨ Azure will now automatically build and deploy your app!**

Wait ~5-10 minutes for first deployment.

---

### Step 5: Initialize Database Schema

After first deployment completes:

**Option A: Use Azure Cloud Shell**

1. In Azure Portal, click the **Cloud Shell** icon (>_) at the top
2. Select **Bash**
3. Run these commands:

```bash
# Clone your repository
git clone https://github.com/YOUR-USERNAME/ITC-2.git
cd ITC-2

# Install dependencies
npm install

# Create .env file with Azure credentials
cat > .env << 'EOF'
DB_HOST=itc-warehouse-db-2025.postgres.database.azure.com
DB_PORT=5432
DB_NAME=itc_warehouse
DB_USER=itcadmin
DB_PASSWORD=your-password-here
EOF

# Run migration
npm run migrate
```

**Option B: Run Locally**

1. Update your local `.env` with Azure database credentials
2. Run: `npm run migrate`

---

### Step 6: Verify Deployment

1. Get your app URL from Azure Portal (Web App → Overview)
2. Your app will be at: `https://itc-warehouse-app-2025.azurewebsites.net`

Test these endpoints:
```bash
# Health check
curl https://itc-warehouse-app-2025.azurewebsites.net/api/health

# Get SKUs
curl https://itc-warehouse-app-2025.azurewebsites.net/api/skus

# Open in browser
open https://itc-warehouse-app-2025.azurewebsites.net
```

---

## 🔄 How Auto-Deployment Works

After setup, whenever you push code to GitHub:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Azure will automatically:
1. ✅ Detect the push
2. ✅ Build your application
3. ✅ Deploy to App Service
4. ✅ Restart the app
5. ✅ Show deployment status in Deployment Center

**Time: ~2-5 minutes per deployment**

---

## 📊 Monitor Your Deployment

### View Deployment Logs

1. Go to Web App → **"Deployment Center"**
2. Click on **"Logs"** tab
3. See build and deployment progress

### View Application Logs

1. Go to Web App → **"Log stream"**
2. See live application logs
3. Or use: **"App Service logs"** → Enable logging

---

## 🎨 Alternative: GitHub Actions (Already Configured!)

I've already created a GitHub Actions workflow for you. To use it:

### Option 1: Using Publish Profile (Simpler)

1. Go to your **Web App** in Azure Portal
2. Click **"Get publish profile"** (top toolbar)
3. Download the file
4. Go to your **GitHub repository**
5. Click **"Settings"** → **"Secrets and variables"** → **"Actions"**
6. Click **"New repository secret"**
   - Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
   - Value: Paste the entire content of the downloaded file
7. Click **"Add secret"**

8. Update `.github/workflows/azure-deploy.yml`:
   - Change `AZURE_WEBAPP_NAME` to your app name: `itc-warehouse-app-2025`

9. Push changes:
```bash
git add .github/workflows/azure-deploy.yml
git commit -m "Configure GitHub Actions deployment"
git push origin main
```

GitHub Actions will now deploy automatically on every push!

---

## 💰 Cost Summary

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| PostgreSQL Flexible Server | B1ms | $12 |
| App Service | B1 | $13 |
| **Total** | | **$25/month** |

Or use Free tier:
- App Service: F1 (Free, limited)
- PostgreSQL: Keep B1ms ($12/month minimum)

---

## 🔧 Troubleshooting

### Deployment Failed?

1. Check **Deployment Center** → **Logs** for errors
2. Common issues:
   - Missing environment variables → Add in Configuration
   - Wrong Node version → Ensure "Node 18 LTS" is selected
   - Database connection → Verify firewall rules

### App Not Starting?

1. Check **Log stream** for errors
2. Verify environment variables in Configuration
3. Test database connection:
   ```bash
   curl https://your-app.azurewebsites.net/api/health
   ```

### Database Connection Failed?

1. Go to PostgreSQL server → **"Networking"**
2. Ensure **"Allow public access from any Azure service"** is enabled
3. Add your current IP if connecting locally
4. Verify credentials in Web App Configuration

---

## 🚀 Quick Command Reference

```bash
# Push code to GitHub (triggers auto-deployment)
git add .
git commit -m "Update feature"
git push origin main

# View Web App logs (requires Azure CLI)
az webapp log tail --name itc-warehouse-app-2025 --resource-group itc-warehouse-rg

# Restart Web App
az webapp restart --name itc-warehouse-app-2025 --resource-group itc-warehouse-rg

# SSH into container
az webapp ssh --name itc-warehouse-app-2025 --resource-group itc-warehouse-rg
```

---

## 📱 Access Your App

Once deployed, share these URLs:

- **Main App**: `https://itc-warehouse-app-2025.azurewebsites.net`
- **For Mobile QR Scanning**: Use the same URL on phones
- **API Endpoint**: `https://itc-warehouse-app-2025.azurewebsites.net/api/*`

---

## 🎉 You're Done!

Your app is now:
- ✅ Deployed on Azure
- ✅ Auto-deploying from GitHub
- ✅ Running with PostgreSQL database
- ✅ Accessible worldwide with HTTPS
- ✅ Backed up automatically

**Next steps:**
1. Set up custom domain (optional)
2. Configure Application Insights for monitoring
3. Set up staging slots for testing
4. Enable auto-scaling if needed

---

## 📚 Additional Resources

- **Azure Portal**: https://portal.azure.com
- **GitHub Repository**: https://github.com/YOUR-USERNAME/ITC-2
- **Azure Documentation**: https://docs.microsoft.com/azure/app-service/
- **Support**: https://azure.microsoft.com/support/

---

**Need help?** Check the deployment logs in Azure Portal or review this guide again.
