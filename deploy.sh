#!/bin/bash

# Azure App Service Deployment Script

# Exit on any error
set -e

echo "Starting deployment..."

# Install dependencies
echo "Installing Node.js dependencies..."
npm install --production

# Create necessary directories
mkdir -p logs

echo "Deployment completed successfully!"
