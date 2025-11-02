#!/bin/bash

echo "🚀 ITC Warehouse - PostgreSQL Setup Script"
echo "==========================================="
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed!"
    echo ""
    echo "Please install PostgreSQL first:"
    echo "  macOS: brew install postgresql@15"
    echo "  Linux: sudo apt-get install postgresql"
    echo "  Windows: Download from postgresql.org"
    exit 1
fi

echo "✅ PostgreSQL is installed"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please update .env with your PostgreSQL password!"
    echo ""
fi

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install
echo ""

# Check if database exists
DB_NAME="itc_warehouse"
DB_USER="${DB_USER:-postgres}"

if psql -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "✅ Database '$DB_NAME' already exists"
else
    echo "📊 Creating database '$DB_NAME'..."
    createdb -U "$DB_USER" "$DB_NAME"
    if [ $? -eq 0 ]; then
        echo "✅ Database created successfully"
    else
        echo "❌ Failed to create database"
        echo "   Try: createdb -U postgres itc_warehouse"
        exit 1
    fi
fi
echo ""

# Run migrations
echo "🔄 Running database migrations..."
node database/migrate.js
if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully"
else
    echo "❌ Migration failed"
    exit 1
fi
echo ""

# Backup old server file
if [ -f server.js ] && [ ! -f server-excel.js ]; then
    echo "💾 Backing up old server.js to server-excel.js..."
    cp server.js server-excel.js
fi

# Use PostgreSQL server
if [ -f server-postgres.js ]; then
    echo "🔄 Switching to PostgreSQL server..."
    cp server-postgres.js server.js
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the server, run:"
echo "  npm start"
echo ""
echo "Server will be available at:"
echo "  http://localhost:3000"
echo ""
