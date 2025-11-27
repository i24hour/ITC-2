#!/bin/bash

echo "🧪 Testing API with single SKU first..."

curl -X POST \
  https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/api/admin/add-new-skus \
  -H "Content-Type: application/json" \
  -d '{
    "newSKUs": ["FXC74050S"]
  }' \
  -w "\n\nHTTP Status: %{http_code}\n"
