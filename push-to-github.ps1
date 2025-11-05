Set-Location "G:\Project\ITC-2"

# Find git executable
$gitPaths = @(
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe",
    "C:\Program Files (x86)\Git\cmd\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
)

$gitExe = $null
foreach ($path in $gitPaths) {
    if (Test-Path $path) {
        $gitExe = $path
        Write-Host "Found Git at: $gitExe"
        break
    }
}

if ($null -eq $gitExe) {
    Write-Host "ERROR: Git not found in common locations"
    pause
    exit 1
}

# Run git commands
& $gitExe add -A
& $gitExe commit -m "Simplify supervisor panel and fix active-skus API endpoint"
& $gitExe push

Write-Host "Done! Press any key to exit..."
pause
