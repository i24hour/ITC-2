#!/bin/bash

echo "═══════════════════════════════════════════════════════════════"
echo "  🚀 QUICK FIX: Add 12 New SKUs to Database"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📋 STEP 1: Open Azure Portal"
echo "   URL: https://portal.azure.com"
echo ""
echo "📋 STEP 2: Navigate to PostgreSQL"
echo "   → Search 'itc-warehouse-db-2025'"
echo "   → Click on the database"
echo "   → Go to 'Query editor' (left sidebar)"
echo ""
echo "📋 STEP 3: Copy this SQL and paste in Query Editor:"
echo ""
cat << 'EOF'
-- Add 12 new SKUs
INSERT INTO "Cleaned_FG_Master_file" (sku, description, uom, created_at, expire_in_days) 
VALUES 
('FXC10020SA', 'FXC10020SA', 'PCS', NOW(), 365),
('FXC170020S', 'FXC170020S', 'PCS', NOW(), 365),
('FXC17005S', 'FXC17005S', 'PCS', NOW(), 365),
('FXC20050S', 'FXC20050S', 'PCS', NOW(), 365),
('FXC30050S', 'FXC30050S', 'PCS', NOW(), 365),
('FXC60005S', 'FXC60005S', 'PCS', NOW(), 365),
('FXC73010S', 'FXC73010S', 'PCS', NOW(), 365),
('FXC73030SA', 'FXC73030SA', 'PCS', NOW(), 365),
('FXC74050S', 'FXC74050S', 'PCS', NOW(), 365),
('FXC75010SA', 'FXC75010SA', 'PCS', NOW(), 365),
('FXC75020SA', 'FXC75020SA', 'PCS', NOW(), 365),
('FXCM', 'FXCM', 'PCS', NOW(), 365)
ON CONFLICT (sku) DO NOTHING;

-- Add to active_skus table
INSERT INTO active_skus (sku, is_active)
SELECT sku, true FROM "Cleaned_FG_Master_file"
WHERE sku IN ('FXC10020SA', 'FXC170020S', 'FXC17005S', 'FXC20050S', 'FXC30050S', 
              'FXC60005S', 'FXC73010S', 'FXC73030SA', 'FXC74050S', 'FXC75010SA', 
              'FXC75020SA', 'FXCM')
ON CONFLICT (sku) DO UPDATE SET is_active = true;

-- Verify
SELECT COUNT(*) as total_skus FROM active_skus WHERE is_active = true;
EOF
echo ""
echo "📋 STEP 4: Click 'Run' button"
echo ""
echo "📋 STEP 5: Verify"
echo "   You should see: total_skus = 70 (58 old + 12 new)"
echo ""
echo "📋 STEP 6: Refresh your browser"
echo "   Press Cmd+Shift+R (Mac) or Ctrl+F5 (Windows)"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ All 12 new SKUs will be visible in the dropdown!"
echo "═══════════════════════════════════════════════════════════════"
