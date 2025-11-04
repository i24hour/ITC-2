const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://itc_user:itc_password@localhost:5432/itc_warehouse',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

console.log('📦 Starting Complete Database Export...\n');

// Create exports directory if it doesn't exist
const exportDir = './exports';
if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
}

// Convert array of objects to CSV
function jsonToCSV(data, headers) {
    if (!data || data.length === 0) return '';
    
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => {
        return headers.map(header => {
            let cell = row[header];
            // Handle nulls, dates, and strings with commas
            if (cell === null || cell === undefined) return '';
            if (cell instanceof Date) return cell.toISOString();
            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
}

async function exportAllTables() {
    const client = await pool.connect();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    try {
        // Get all table names
        console.log('🔍 Discovering all tables...\n');
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        
        const tables = tablesResult.rows.map(r => r.table_name);
        console.log(`Found ${tables.length} tables:\n${tables.map(t => `  - ${t}`).join('\n')}\n`);
        
        const exportSummary = {
            exportDate: new Date().toISOString(),
            totalTables: tables.length,
            tables: {}
        };
        
        // Export each table
        for (const tableName of tables) {
            try {
                console.log(`📋 Exporting ${tableName}...`);
                
                // Get table structure
                const structureResult = await client.query(`
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_name = $1
                    ORDER BY ordinal_position
                `, [tableName]);
                
                const columns = structureResult.rows;
                const columnNames = columns.map(c => c.column_name);
                
                // Get row count
                const countResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
                const rowCount = parseInt(countResult.rows[0].count);
                
                // Get all data
                const dataResult = await client.query(`SELECT * FROM "${tableName}" ORDER BY 1`);
                const data = dataResult.rows;
                
                // Save structure
                const structureFile = path.join(exportDir, `${tableName}_structure.json`);
                fs.writeFileSync(structureFile, JSON.stringify(columns, null, 2));
                
                // Save data as JSON
                const jsonFile = path.join(exportDir, `${tableName}_data.json`);
                fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2));
                
                // Save data as CSV
                const csvFile = path.join(exportDir, `${tableName}_data.csv`);
                const csvContent = jsonToCSV(data, columnNames);
                fs.writeFileSync(csvFile, csvContent);
                
                exportSummary.tables[tableName] = {
                    rowCount: rowCount,
                    columns: columnNames.length,
                    files: {
                        structure: `${tableName}_structure.json`,
                        json: `${tableName}_data.json`,
                        csv: `${tableName}_data.csv`
                    }
                };
                
                console.log(`   ✅ ${rowCount} rows exported (JSON + CSV + Structure)\n`);
                
            } catch (err) {
                console.error(`   ❌ Error exporting ${tableName}:`, err.message);
                exportSummary.tables[tableName] = { error: err.message };
            }
        }
        
        // Save export summary
        const summaryFile = path.join(exportDir, `export_summary_${timestamp}.json`);
        fs.writeFileSync(summaryFile, JSON.stringify(exportSummary, null, 2));
        
        // Create a combined backup file
        const backupFile = path.join(exportDir, `database_backup_${timestamp}.json`);
        const backup = {
            exportDate: new Date().toISOString(),
            databaseInfo: exportSummary,
            data: {}
        };
        
        for (const tableName of tables) {
            try {
                const jsonFile = path.join(exportDir, `${tableName}_data.json`);
                if (fs.existsSync(jsonFile)) {
                    backup.data[tableName] = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
                }
            } catch (err) {
                console.error(`Error reading ${tableName}:`, err.message);
            }
        }
        
        fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
        
        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('✅ DATABASE EXPORT COMPLETE!');
        console.log('='.repeat(60));
        console.log(`\n📁 Export Directory: ${path.resolve(exportDir)}\n`);
        console.log('📊 Export Summary:');
        console.log(`   Total Tables: ${exportSummary.totalTables}`);
        
        let totalRows = 0;
        for (const [tableName, info] of Object.entries(exportSummary.tables)) {
            if (info.rowCount !== undefined) {
                console.log(`   - ${tableName}: ${info.rowCount} rows`);
                totalRows += info.rowCount;
            }
        }
        
        console.log(`\n   Total Records: ${totalRows}`);
        console.log(`\n📦 Files Created:`);
        console.log(`   - Individual table files (JSON + CSV + Structure)`);
        console.log(`   - Combined backup: database_backup_${timestamp}.json`);
        console.log(`   - Export summary: export_summary_${timestamp}.json`);
        console.log('\n' + '='.repeat(60) + '\n');
        
    } catch (error) {
        console.error('❌ Export failed:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run export
exportAllTables();
