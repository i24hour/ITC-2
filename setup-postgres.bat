@echo off
echo.
echo ========================================
echo ITC Warehouse - PostgreSQL Setup Script
echo ========================================
echo.

REM Check if PostgreSQL is installed
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PostgreSQL is not installed!
    echo.
    echo Please install PostgreSQL first:
    echo   Download from: https://www.postgresql.org/download/windows/
    echo.
    pause
    exit /b 1
)

echo [OK] PostgreSQL is installed
echo.

REM Check if .env file exists
if not exist .env (
    echo [INFO] Creating .env file...
    copy .env.example .env
    echo [WARNING] Please update .env with your PostgreSQL password!
    echo.
)

REM Install dependencies
echo [INFO] Installing Node.js dependencies...
call npm install
echo.

REM Create database (you may need to adjust credentials)
echo [INFO] Creating database 'itc_warehouse'...
createdb -U postgres itc_warehouse 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Database created successfully
) else (
    echo [INFO] Database may already exist or credentials need adjustment
)
echo.

REM Run migrations
echo [INFO] Running database migrations...
node database\migrate.js
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Migration failed
    pause
    exit /b 1
)
echo.

REM Backup old server file
if exist server.js (
    if not exist server-excel.js (
        echo [INFO] Backing up old server.js to server-excel.js...
        copy server.js server-excel.js
    )
)

REM Use PostgreSQL server
if exist server-postgres.js (
    echo [INFO] Switching to PostgreSQL server...
    copy /Y server-postgres.js server.js
)

echo.
echo ========================================
echo [SUCCESS] Setup complete!
echo ========================================
echo.
echo To start the server, run:
echo   npm start
echo.
echo Server will be available at:
echo   http://localhost:3000
echo.
pause
