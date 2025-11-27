#!/bin/bash
# Add 12 new SKUs directly to Azure PostgreSQL

echo "🔐 Getting Azure token..."
export PGHOST=itc-warehouse-db-2025.postgres.database.azure.com
export PGUSER=priyanshu85953@gmail.com
export PGPORT=5432
export PGDATABASE=postgres
export PGPASSWORD="$(az account get-access-token --resource https://ossrdbms-aad.database.windows.net --query accessToken --output tsv)"

echo "📝 Adding 12 new SKUs to Cleaned_FG_Master_file..."
psql -c "INSERT INTO \"Cleaned_FG_Master_file\" (sku, description, uom, created_at, expire_in_days) VALUES ('FXC10020SA', 'FXC10020SA', 2.0, NOW(), 365), ('FXC170020S', 'FXC170020S', 2.0, NOW(), 365), ('FXC17005S', 'FXC17005S', 2.0, NOW(), 365), ('FXC20050S', 'FXC20050S', 2.0, NOW(), 365), ('FXC30050S', 'FXC30050S', 2.0, NOW(), 365), ('FXC60005S', 'FXC60005S', 2.0, NOW(), 365), ('FXC73010S', 'FXC73010S', 2.0, NOW(), 365), ('FXC73030SA', 'FXC73030SA', 2.0, NOW(), 365), ('FXC74050S', 'FXC74050S', 2.0, NOW(), 365), ('FXC75010SA', 'FXC75010SA', 2.0, NOW(), 365), ('FXC75020SA', 'FXC75020SA', 2.0, NOW(), 365), ('FXCM', 'FXCM', 2.0, NOW(), 365) ON CONFLICT (sku) DO NOTHING;"

echo "✅ Adding to active_skus..."
psql -c "INSERT INTO active_skus (sku, is_active) VALUES ('FXC10020SA', true), ('FXC170020S', true), ('FXC17005S', true), ('FXC20050S', true), ('FXC30050S', true), ('FXC60005S', true), ('FXC73010S', true), ('FXC73030SA', true), ('FXC74050S', true), ('FXC75010SA', true), ('FXC75020SA', true), ('FXCM', true) ON CONFLICT (sku) DO UPDATE SET is_active = true;"

echo "🔍 Verifying..."
psql -c "SELECT COUNT(*) as total_active_skus FROM active_skus WHERE is_active = true;"

echo "✅ Done! Now refresh your browser (Cmd+Shift+R) to see all SKUs!"
