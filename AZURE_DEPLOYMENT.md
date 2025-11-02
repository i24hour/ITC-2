# Azure Deployment Guide for ITC Warehouse Management System

## Prerequisites

1. **Azure Account**: Create a free account at https://azure.microsoft.com/free/
2. **Azure CLI**: Install from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
   ```bash
   # macOS
   brew install azure-cli
   
   # Verify installation
   az --version
   ```

## Deployment Options

### Option 1: Automated Deployment (Recommended)

We've created an automated deployment script that sets up everything:

```bash
chmod +x azure-deploy.sh
./azure-deploy.sh
```

This script will:
- Create a Resource Group
- Create Azure Database for PostgreSQL (Flexible Server)
- Create an App Service Plan and Web App
- Configure environment variables
- Set up deployment credentials

**Follow the prompts and provide:**
- Resource Group Name (e.g., `itc-warehouse-rg`)
- Location (e.g., `eastus`, `westus`, `centralindia`)
- App Service Name (must be unique, e.g., `itc-warehouse-app-123`)
- PostgreSQL Server Name (must be unique, e.g., `itc-warehouse-db-123`)
- Database credentials

### Option 2: Azure Portal (Manual)

#### Step 1: Create PostgreSQL Database

1. Go to Azure Portal (https://portal.azure.com)
2. Click "Create a resource" → Search "Azure Database for PostgreSQL"
3. Select "Flexible server" → Click "Create"
4. Configure:
   - **Resource Group**: Create new (e.g., `itc-warehouse-rg`)
   - **Server Name**: Choose unique name (e.g., `itc-warehouse-db-123`)
   - **Region**: Choose closest to your users
   - **PostgreSQL Version**: 14
   - **Compute + Storage**: Burstable, B1ms (1 vCore, 2GB RAM) - $12/month
   - **Admin Username**: Set username
   - **Password**: Set secure password
   - **Networking**: Allow access from Azure services
5. Click "Review + Create" → "Create"

#### Step 2: Create Web App

1. Click "Create a resource" → Search "Web App"
2. Configure:
   - **Resource Group**: Use same as database
   - **Name**: Choose unique name (e.g., `itc-warehouse-app-123`)
   - **Publish**: Code
   - **Runtime Stack**: Node 18 LTS
   - **Operating System**: Linux
   - **Region**: Same as database
   - **App Service Plan**: Create new, B1 tier ($13/month)
3. Click "Review + Create" → "Create"

#### Step 3: Configure Environment Variables

1. Go to your Web App → "Configuration" → "Application settings"
2. Add these settings:
   ```
   DB_HOST=<your-db-server>.postgres.database.azure.com
   DB_PORT=5432
   DB_NAME=itc_warehouse
   DB_USER=<your-admin-username>
   DB_PASSWORD=<your-admin-password>
   NODE_ENV=production
   ```
3. Click "Save"

#### Step 4: Deploy Code

**Option A: Deploy from GitHub**
1. Go to Web App → "Deployment Center"
2. Choose "GitHub" → Authorize and select your repository
3. Select branch: `main`
4. Save and Azure will auto-deploy

**Option B: Deploy via ZIP**
1. Create deployment package:
   ```bash
   npm install --production
   zip -r deployment.zip . -x "*.git*" "*.xlsx" "node_modules/*"
   ```
2. Deploy:
   ```bash
   az webapp deployment source config-zip \
     --resource-group itc-warehouse-rg \
     --name itc-warehouse-app-123 \
     --src deployment.zip
   ```

**Option C: Deploy via Git**
1. Get deployment URL from Web App → "Deployment Center"
2. Add remote and push:
   ```bash
   git remote add azure <deployment-url>
   git push azure main
   ```

#### Step 5: Initialize Database

After deployment, you need to create database schema:

**Option A: Connect locally and migrate**
```bash
# Update .env with Azure database credentials
DB_HOST=<your-db-server>.postgres.database.azure.com
DB_PORT=5432
DB_NAME=itc_warehouse
DB_USER=<your-admin-username>
DB_PASSWORD=<your-admin-password>

# Run migration
npm run migrate
```

**Option B: Use Azure Cloud Shell**
1. Open Azure Cloud Shell in portal
2. Clone your repo
3. Update .env with Azure credentials
4. Run `npm install && npm run migrate`

## Post-Deployment Steps

### 1. Verify Deployment
```bash
# Check if app is running
curl https://<your-app-name>.azurewebsites.net/api/skus

# Should return array of SKUs
```

### 2. Configure Custom Domain (Optional)
1. Go to Web App → "Custom domains"
2. Add your domain name
3. Configure DNS records as shown

### 3. Enable HTTPS (Automatic)
Azure provides free SSL certificate automatically

### 4. Set up Monitoring
1. Go to Web App → "Application Insights"
2. Enable Application Insights for performance monitoring

### 5. Configure Backups
1. Go to PostgreSQL Server → "Backup and restore"
2. Configure automated backups (enabled by default)

## Cost Estimation

Monthly costs (approximate):
- **PostgreSQL Flexible Server (B1ms)**: ~$12/month
- **App Service Plan (B1)**: ~$13/month
- **Storage**: ~$1/month
- **Total**: ~$26/month

You can start with a free tier for App Service (F1) which is free but has limitations.

## Troubleshooting

### App won't start
1. Check logs:
   ```bash
   az webapp log tail --name <app-name> --resource-group <rg-name>
   ```
2. Verify environment variables in Configuration
3. Check that Node version matches (18 LTS)

### Database connection issues
1. Check firewall rules allow Azure services
2. Verify connection string in Application settings
3. Test connection with psql:
   ```bash
   psql "host=<server>.postgres.database.azure.com port=5432 dbname=itc_warehouse user=<user> password=<pass> sslmode=require"
   ```

### Deployment failed
1. Check deployment logs in Deployment Center
2. Ensure package.json has correct start script
3. Verify all dependencies are in dependencies (not devDependencies)

## Scaling

To scale your application:

**Vertical Scaling (More power)**
```bash
az appservice plan update \
  --name <plan-name> \
  --resource-group <rg-name> \
  --sku S1  # Standard tier
```

**Horizontal Scaling (More instances)**
```bash
az appservice plan update \
  --name <plan-name> \
  --resource-group <rg-name> \
  --number-of-workers 3
```

## Security Best Practices

1. **Use Azure Key Vault** for sensitive data
2. **Enable Azure AD Authentication** for database
3. **Configure VNet Integration** for private networking
4. **Set up Azure Front Door** for DDoS protection
5. **Enable Diagnostic Logs** for auditing

## Useful Commands

```bash
# View all resources
az resource list --resource-group itc-warehouse-rg --output table

# Restart web app
az webapp restart --name <app-name> --resource-group <rg-name>

# View logs
az webapp log tail --name <app-name> --resource-group <rg-name>

# SSH into container
az webapp ssh --name <app-name> --resource-group <rg-name>

# Delete all resources
az group delete --name itc-warehouse-rg --yes
```

## Support

- Azure Documentation: https://docs.microsoft.com/azure/
- Azure Support: https://azure.microsoft.com/support/
- Community Forums: https://docs.microsoft.com/answers/

---

**Need Help?** Open an issue in the repository or contact the development team.
