# Azure Deployment Checklist

## Pre-Deployment
- [ ] Install Azure CLI: `brew install azure-cli`
- [ ] Login to Azure: `az login`
- [ ] Choose deployment method (automated script or manual)

## Deployment Steps

### Using Automated Script (Fastest)
- [ ] Make script executable: `chmod +x azure-deploy.sh`
- [ ] Run script: `./azure-deploy.sh`
- [ ] Provide required information when prompted:
  - Resource Group Name
  - Location (e.g., centralindia, eastus)
  - App Service Name (must be globally unique)
  - PostgreSQL Server Name (must be globally unique)
  - Database credentials
- [ ] Wait for resources to be created (~10 minutes)

### After Infrastructure Setup
- [ ] Update local .env with Azure database credentials
- [ ] Run database migration: `npm run migrate`
- [ ] Deploy application code:
  
  **Option A: Git Deployment**
  ```bash
  git remote add azure <deployment-url-from-script>
  git push azure main
  ```
  
  **Option B: ZIP Deployment**
  ```bash
  npm install --production
  zip -r deployment.zip . -x "*.git*" "*.xlsx" "node_modules/*"
  az webapp deployment source config-zip \
    --resource-group <your-rg-name> \
    --name <your-app-name> \
    --src deployment.zip
  ```

## Verification
- [ ] Check app is running: `https://<your-app-name>.azurewebsites.net`
- [ ] Test API endpoints:
  - [ ] `/api/skus` - Should return list of SKUs
  - [ ] `/api/inventory` - Should return inventory data
  - [ ] `/api/reports/summary` - Should return summary stats
- [ ] Test QR code scanning functionality
- [ ] Test incoming/outgoing operations

## Optional: GitHub Actions CI/CD
- [ ] Push code to GitHub repository
- [ ] Go to Azure Web App → Deployment Center
- [ ] Get Publish Profile and add to GitHub Secrets as `AZURE_WEBAPP_PUBLISH_PROFILE`
- [ ] Update `.github/workflows/azure-deploy.yml` with your app name
- [ ] Push changes - auto-deployment should trigger

## Post-Deployment Configuration
- [ ] Configure custom domain (if needed)
- [ ] Enable Application Insights for monitoring
- [ ] Set up database backup schedule
- [ ] Configure scaling options based on usage
- [ ] Review and optimize costs

## Estimated Costs
- PostgreSQL Flexible Server (B1ms): ~$12/month
- App Service Plan (B1): ~$13/month
- Total: ~$25-30/month

## Support Resources
- Azure Portal: https://portal.azure.com
- Documentation: See AZURE_DEPLOYMENT.md
- Logs: `az webapp log tail --name <app-name> --resource-group <rg-name>`

## Troubleshooting
If deployment fails:
1. Check Azure Portal for error messages
2. View app logs: `az webapp log tail --name <app-name> --resource-group <rg-name>`
3. Verify environment variables in App Service Configuration
4. Check database connectivity and firewall rules
5. Ensure all dependencies are in package.json (not devDependencies)

---

**Ready to Deploy?**
Run: `./azure-deploy.sh`
