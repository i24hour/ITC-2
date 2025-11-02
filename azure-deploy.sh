#!/bin/bash

# Azure Deployment Script for ITC Warehouse Management System
# This script will help you deploy the application to Azure

set -e

echo "🚀 Azure Deployment Helper for ITC Warehouse System"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed${NC}"
    echo ""
    echo "Please install Azure CLI first:"
    echo "  macOS: brew install azure-cli"
    echo "  Or visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

echo -e "${GREEN}✅ Azure CLI found${NC}"
echo ""

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Azure${NC}"
    echo "Logging in..."
    az login
fi

echo -e "${GREEN}✅ Logged in to Azure${NC}"
echo ""

# Get current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "${BLUE}📋 Current Subscription: $SUBSCRIPTION${NC}"
echo ""

# Prompt for deployment details
echo "Please provide deployment details:"
echo ""

read -p "Resource Group Name (e.g., itc-warehouse-rg): " RESOURCE_GROUP
read -p "Location (e.g., eastus, westus, centralindia): " LOCATION
read -p "App Service Name (unique, e.g., itc-warehouse-app-123): " APP_NAME
read -p "PostgreSQL Server Name (unique, e.g., itc-warehouse-db-123): " DB_SERVER_NAME
read -p "Database Admin Username: " DB_ADMIN_USER
read -sp "Database Admin Password: " DB_ADMIN_PASSWORD
echo ""
read -p "Database Name (default: itc_warehouse): " DB_NAME
DB_NAME=${DB_NAME:-itc_warehouse}

echo ""
echo -e "${BLUE}📝 Deployment Configuration:${NC}"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Location: $LOCATION"
echo "  App Service: $APP_NAME"
echo "  PostgreSQL Server: $DB_SERVER_NAME"
echo "  Database: $DB_NAME"
echo ""

read -p "Continue with deployment? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}🔨 Step 1: Creating Resource Group${NC}"
az group create --name $RESOURCE_GROUP --location $LOCATION

echo ""
echo -e "${BLUE}🔨 Step 2: Creating PostgreSQL Server${NC}"
echo "This may take 5-10 minutes..."
az postgres flexible-server create \
    --resource-group $RESOURCE_GROUP \
    --name $DB_SERVER_NAME \
    --location $LOCATION \
    --admin-user $DB_ADMIN_USER \
    --admin-password $DB_ADMIN_PASSWORD \
    --sku-name Standard_B1ms \
    --tier Burstable \
    --public-access 0.0.0.0 \
    --storage-size 32 \
    --version 14

echo ""
echo -e "${BLUE}🔨 Step 3: Creating Database${NC}"
az postgres flexible-server db create \
    --resource-group $RESOURCE_GROUP \
    --server-name $DB_SERVER_NAME \
    --database-name $DB_NAME

echo ""
echo -e "${BLUE}🔨 Step 4: Configuring Firewall${NC}"
az postgres flexible-server firewall-rule create \
    --resource-group $RESOURCE_GROUP \
    --name $DB_SERVER_NAME \
    --rule-name AllowAzureServices \
    --start-ip-address 0.0.0.0 \
    --end-ip-address 0.0.0.0

echo ""
echo -e "${BLUE}🔨 Step 5: Creating App Service Plan${NC}"
az appservice plan create \
    --name ${APP_NAME}-plan \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --sku B1 \
    --is-linux

echo ""
echo -e "${BLUE}🔨 Step 6: Creating Web App${NC}"
az webapp create \
    --resource-group $RESOURCE_GROUP \
    --plan ${APP_NAME}-plan \
    --name $APP_NAME \
    --runtime "NODE:18-lts"

echo ""
echo -e "${BLUE}🔨 Step 7: Configuring Environment Variables${NC}"
DB_HOST="${DB_SERVER_NAME}.postgres.database.azure.com"
CONNECTION_STRING="postgresql://${DB_ADMIN_USER}:${DB_ADMIN_PASSWORD}@${DB_HOST}:5432/${DB_NAME}?sslmode=require"

az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --settings \
    DB_HOST=$DB_HOST \
    DB_PORT=5432 \
    DB_NAME=$DB_NAME \
    DB_USER=$DB_ADMIN_USER \
    DB_PASSWORD=$DB_ADMIN_PASSWORD \
    NODE_ENV=production \
    WEBSITE_NODE_DEFAULT_VERSION="~18" \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true

echo ""
echo -e "${BLUE}🔨 Step 8: Deploying Application${NC}"
echo "Setting up deployment from local git..."

# Get deployment credentials
DEPLOY_USER=$(az webapp deployment list-publishing-credentials \
    --resource-group $RESOURCE_GROUP \
    --name $APP_NAME \
    --query publishingUserName -o tsv)

DEPLOY_URL="https://${APP_NAME}.scm.azurewebsites.net/${APP_NAME}.git"

echo ""
echo -e "${GREEN}✅ Azure Resources Created Successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Information:${NC}"
echo "  App URL: https://${APP_NAME}.azurewebsites.net"
echo "  Database Host: $DB_HOST"
echo "  Git Deployment URL: $DEPLOY_URL"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo ""
echo "1. Initialize Database Schema:"
echo "   You need to run the migration script against Azure PostgreSQL"
echo "   Update your .env with Azure credentials and run: npm run migrate"
echo ""
echo "2. Deploy Code via Git:"
echo "   git remote add azure $DEPLOY_URL"
echo "   git push azure main"
echo ""
echo "3. Or deploy via ZIP:"
echo "   az webapp deployment source config-zip \\"
echo "     --resource-group $RESOURCE_GROUP \\"
echo "     --name $APP_NAME \\"
echo "     --src deployment.zip"
echo ""
echo -e "${GREEN}🎉 Deployment infrastructure setup complete!${NC}"
