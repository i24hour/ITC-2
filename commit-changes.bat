@echo off
cd /d "G:\Project\ITC-2"
git add .
git commit -m "Simplify supervisor panel to only SKU management and fix active-skus API endpoint"
git push
pause
