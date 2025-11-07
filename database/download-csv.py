#!/usr/bin/env python3
import psycopg2
import csv
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("🔌 Connecting to Azure PostgreSQL...")
print(f"📍 Host: {os.getenv('DB_HOST')}")
print(f"📍 Database: {os.getenv('DB_NAME')}")
print(f"📍 User: {os.getenv('DB_USER')}\n")

try:
    # Connect to database
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT', 5432),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        sslmode='require',
        connect_timeout=30
    )
    
    print("✅ Connected successfully!\n")
    print("📥 Downloading Cleaned_FG_Master_file table...\n")
    
    # Create cursor
    cur = conn.cursor()
    
    # Execute query
    cur.execute('''
        SELECT sku, description, uom, aging_days, created_at
        FROM "Cleaned_FG_Master_file"
        ORDER BY sku
    ''')
    
    # Fetch all rows
    rows = cur.fetchall()
    
    print(f"✅ Fetched {len(rows)} records\n")
    
    if len(rows) == 0:
        print("⚠️  Table is empty!")
        exit(0)
    
    # Write to CSV
    filename = 'Cleaned_FG_Master_file_export.csv'
    
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        
        # Write header
        writer.writerow(['SKU', 'Description', 'UOM', 'Aging Days', 'Created At'])
        
        # Write data
        writer.writerows(rows)
    
    file_size = os.path.getsize(filename) / 1024
    
    print("=" * 60)
    print("✅ CSV FILE DOWNLOADED SUCCESSFULLY!")
    print("=" * 60)
    print(f"📄 Filename: {filename}")
    print(f"📊 Total Records: {len(rows)}")
    print(f"💾 File Size: {file_size:.2f} KB")
    print("=" * 60)
    print(f"\n📂 File Location: {os.path.abspath(filename)}\n")
    
    # Close cursor and connection
    cur.close()
    conn.close()
    print("🔌 Connection closed\n")
    
except Exception as e:
    print(f"\n❌ ERROR: {str(e)}")
    print("\n💡 Troubleshooting:")
    print("   1. Check if your IP is whitelisted in Azure PostgreSQL firewall")
    print("   2. Verify .env file has correct credentials")
    print("   3. Install psycopg2: pip3 install psycopg2-binary python-dotenv\n")
