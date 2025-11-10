const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const cors = require('cors');
const os = require('os');
const db = require('./database/db');
const sessions = require('./database/sessions');
const { autoRestructure } = require('./database/auto-restructure');
const { migrateSessionsTable } = require('./database/migrate-sessions');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Helper function to generate batch number in IST timezone (UTC+5:30)
function generateBatchNumber() {
  // Get current time in IST (UTC + 5:30)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istDate = new Date(now.getTime() + istOffset);
  
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[istDate.getUTCMonth()];
  const year = String(istDate.getUTCFullYear()).slice(-2);
  
  return `Z${day}${month}${year}`;
}

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIP();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ==================== HEALTH CHECK ENDPOINT ====================

// Health check endpoint for Azure App Service
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    const result = await db.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      database: 'disconnected'
    });
  }
});

// Database status check endpoint (for debugging)
app.get('/api/db-status', async (req, res) => {
  const client = await db.getClient();
  try {
    const status = {
      timestamp: new Date().toISOString(),
      tables: {},
      counts: {}
    };
    
    // Check if tables exist
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'Operators', 'Task_History', 'user_sessions', 
        'Cleaned_FG_Master_file', 'Bin_Inventory', 'Bins',
        'Incoming', 'Outgoing', 'Historical_Log'
      )
      ORDER BY table_name;
    `);
    
    status.existingTables = tablesCheck.rows.map(r => r.table_name);
    
    // Check Bins table
    if (status.existingTables.includes('Bins')) {
      const binsCount = await client.query('SELECT COUNT(*) as count FROM "Bins"');
      const emptyBins = await client.query('SELECT COUNT(*) as count FROM "Bins" WHERE status = \'empty\'');
      status.counts.totalBins = binsCount.rows[0].count;
      status.counts.emptyBins = emptyBins.rows[0].count;
    }
    
    // Check Bin_Inventory table
    if (status.existingTables.includes('Bin_Inventory')) {
      const inventoryCount = await client.query('SELECT COUNT(*) as count FROM "Bin_Inventory"');
      status.counts.inventoryRecords = inventoryCount.rows[0].count;
    }
    
    // Check Incoming table
    if (status.existingTables.includes('Incoming')) {
      const incomingCount = await client.query('SELECT COUNT(*) as count FROM "Incoming"');
      const recentIncoming = await client.query('SELECT id, sku, quantity, bin_no, operator_id FROM "Incoming" ORDER BY incoming_date DESC LIMIT 5');
      status.counts.incomingRecords = incomingCount.rows[0].count;
      status.tables.incoming = recentIncoming.rows;
    }
    
    // Check Outgoing table
    if (status.existingTables.includes('Outgoing')) {
      const outgoingCount = await client.query('SELECT COUNT(*) as count FROM "Outgoing"');
      const recentOutgoing = await client.query('SELECT id, sku, quantity, bin_no, operator_id FROM "Outgoing" ORDER BY outgoing_date DESC LIMIT 5');
      status.counts.outgoingRecords = outgoingCount.rows[0].count;
      status.tables.outgoing = recentOutgoing.rows;
    }
    
    // Check Operators table
    if (status.existingTables.includes('Operators')) {
      const operatorsCount = await client.query('SELECT COUNT(*) as count FROM "Operators"');
      const recentOperators = await client.query('SELECT operator_id, name, email FROM "Operators" ORDER BY created_at DESC LIMIT 5');
      status.counts.operators = operatorsCount.rows[0].count;
      status.tables.operators = recentOperators.rows;
    }
    
    // Check Task_History table
    if (status.existingTables.includes('Task_History')) {
      const tasksCount = await client.query('SELECT COUNT(*) as count FROM "Task_History"');
      const recentTasks = await client.query(`
        SELECT id, operator_id, operator_name, task_type, sku, quantity 
        FROM "Task_History" 
        ORDER BY completed_at DESC 
        LIMIT 5
      `);
      status.counts.tasks = tasksCount.rows[0].count;
      status.tables.taskHistory = recentTasks.rows;
    }
    
    // Check user_sessions table
    if (status.existingTables.includes('user_sessions')) {
      const sessionsCount = await client.query('SELECT COUNT(*) as count FROM user_sessions');
      const activeSessions = await client.query('SELECT COUNT(*) as count FROM user_sessions WHERE expires_at > NOW()');
      status.counts.totalSessions = sessionsCount.rows[0].count;
      status.counts.activeSessions = activeSessions.rows[0].count;
    }
    
    res.json(status);
  } catch (error) {
    console.error('Error in db-status:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  } finally {
    client.release();
  }
});

// Manual trigger for database restructure (ADMIN ONLY - for debugging)
app.post('/api/admin/restructure', async (req, res) => {
  try {
    console.log('🔧 Manual database restructure triggered...');
    await autoRestructure();
    res.json({ 
      success: true, 
      message: 'Database restructure completed. Check /api/db-status to verify.' 
    });
  } catch (error) {
    console.error('❌ Manual restructure failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      stack: error.stack 
    });
  }
});

// Create essential tables only (Operators, Task_History) without Excel dependency
app.post('/api/admin/create-essential-tables', async (req, res) => {
  try {
    console.log('🔧 Creating essential tables (Operators, Task_History)...');
    const { createEssentialTables } = require('./database/create-essential-tables');
    const result = await createEssentialTables();
    res.json({ 
      success: true, 
      message: 'Essential tables created successfully! Operators and Task_History tables are now ready.',
      details: result
    });
  } catch (error) {
    console.error('❌ Failed to create essential tables:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      stack: error.stack 
    });
  }
});

// Update Inventory structure - add weight column and remove Bin_Inventory (ADMIN ONLY)
app.post('/api/admin/update-inventory-weight', async (req, res) => {
  try {
    console.log('🔧 Updating Inventory table structure...');
    const { updateInventoryStructure } = require('./database/update-inventory-weight');
    await updateInventoryStructure();
    res.json({ 
      success: true, 
      message: 'Inventory table updated with weight column. Bin_Inventory table dropped.' 
    });
  } catch (error) {
    console.error('❌ Inventory structure update failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin endpoint: Migrate to new database structure
app.post('/api/admin/migrate-structure', async (req, res) => {
  const client = await db.getClient();
  try {
    console.log('🔄 Starting database structure migration...');
    
    const results = {
      cleanedFGMaster: 0,
      inventoryCreated: false,
      dataMigrated: 0,
      nonEmptyBins: 0
    };
    
    // Step 1: Create Cleaned_FG_Master_file with hardcoded SKUs (no Excel needed on server)
    console.log('📋 Creating Cleaned_FG_Master_file...');
    await client.query('DROP TABLE IF EXISTS "Cleaned_FG_Master_file" CASCADE');
    await client.query(`
      CREATE TABLE "Cleaned_FG_Master_file" (
        sku VARCHAR(50) PRIMARY KEY,
        description TEXT NOT NULL,
        uom DECIMAL(10,3) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Hardcoded essential SKUs (you can add more later)
    const essentialSKUs = [
      { sku: '210001', description: 'BINGO TEDHE MEDHE 60G', uom: 10.5 },
      { sku: '210002', description: 'BINGO YUMITOS PARTY MIX 26G', uom: 12.0 },
      { sku: '210003', description: 'BINGO MAD ANGLES 72.5G', uom: 9.5 },
      // Add more as needed
    ];
    
    for (const { sku, description, uom } of essentialSKUs) {
      await client.query(
        `INSERT INTO "Cleaned_FG_Master_file" (sku, description, uom) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (sku) DO NOTHING`,
        [sku, description, uom]
      );
    }
    results.cleanedFGMaster = essentialSKUs.length;
    
    // Step 2: Create new Inventory table (capitalized)
    console.log('📦 Creating new Inventory table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Inventory" (
        id SERIAL PRIMARY KEY,
        bin_no VARCHAR(10) NOT NULL,
        sku VARCHAR(50) NOT NULL,
        batch_no VARCHAR(20) NOT NULL,
        cfc INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        uom DECIMAL(10,3),
        weight DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(bin_no, sku)
      )
    `);
    results.inventoryCreated = true;
    
    // Step 2.5: Create Pending_Tasks table (for incomplete incoming/outgoing tasks)
    console.log('📦 Creating Pending_Tasks table...');
    
    // Drop existing table if it exists (for migration)
    await client.query(`DROP TABLE IF EXISTS "Pending_Tasks"`);
    console.log('🗑️  Dropped old Pending_Tasks table');
    
    // Create new table with correct schema
    await client.query(`
      CREATE TABLE "Pending_Tasks" (
        id SERIAL PRIMARY KEY,
        operator_id VARCHAR(20) NOT NULL,
        task_type VARCHAR(20) NOT NULL CHECK (task_type IN ('incoming', 'outgoing')),
        sku VARCHAR(50) NOT NULL,
        bin_no VARCHAR(20),
        cfc INTEGER,
        weight DECIMAL(10,2),
        batch_no VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired'))
      )
    `);
    console.log('✅ Pending_Tasks table created (with nullable bin_no and cfc)');
    
    // Create index for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pending_tasks_expires 
      ON "Pending_Tasks" (expires_at)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pending_tasks_operator 
      ON "Pending_Tasks" (operator_id, status)
    `);
    console.log('✅ Pending_Tasks table created');
    
    // Step 3: Migrate data from old inventory table to new Inventory table
    console.log('🔄 Migrating data from old inventory table...');
    const checkOldTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'inventory'
      )
    `);
    
    if (checkOldTable.rows[0].exists) {
      const oldData = await client.query(`SELECT * FROM inventory`);
      console.log(`   Found ${oldData.rows.length} records in old inventory table`);
      
      for (const row of oldData.rows) {
        try {
          await client.query(`
            INSERT INTO "Inventory" (bin_no, sku, batch_no, cfc, description, uom, weight, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (bin_no, sku) DO UPDATE SET
              cfc = EXCLUDED.cfc,
              batch_no = EXCLUDED.batch_no,
              description = EXCLUDED.description,
              uom = EXCLUDED.uom,
              weight = EXCLUDED.weight,
              updated_at = EXCLUDED.updated_at
          `, [
            row.bin_no,
            row.sku,
            row.batch_no || 'Z01JAN25',
            row.cfc || 0,
            row.description,
            row.uom,
            row.weight,
            row.created_at || new Date(),
            row.updated_at || new Date()
          ]);
          results.dataMigrated++;
        } catch (err) {
          console.log(`   Warning: Could not migrate row for bin ${row.bin_no}, SKU ${row.sku}`);
        }
      }
    }
    
    // Step 4: Count non-empty bins
    const nonEmptyResult = await client.query(`SELECT COUNT(*) as count FROM "Inventory" WHERE cfc > 0`);
    results.nonEmptyBins = parseInt(nonEmptyResult.rows[0].count);
    
    console.log('✅ Migration complete:', results);
    
    res.json({
      success: true,
      message: 'Database structure migration completed successfully',
      results: results
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  } finally {
    client.release();
  }
});

// Admin endpoint: Export all database tables
app.get('/api/admin/export-database', async (req, res) => {
  const client = await db.getClient();
  try {
    console.log('📦 Starting database export...');
    
    // Get all table names
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} tables`);
    
    const exportData = {
      exportDate: new Date().toISOString(),
      totalTables: tables.length,
      data: {},
      summary: {}
    };
    
    // Export each table
    for (const tableName of tables) {
      try {
        // Get row count
        const countResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const rowCount = parseInt(countResult.rows[0].count);
        
        // Get all data
        const dataResult = await client.query(`SELECT * FROM "${tableName}" ORDER BY 1`);
        
        exportData.data[tableName] = dataResult.rows;
        exportData.summary[tableName] = {
          rowCount: rowCount,
          columns: dataResult.fields.map(f => f.name)
        };
        
        console.log(`   ✅ Exported ${tableName}: ${rowCount} rows`);
        
      } catch (err) {
        console.error(`   ❌ Error exporting ${tableName}:`, err.message);
        exportData.summary[tableName] = { error: err.message };
      }
    }
    
    console.log('✅ Database export complete');
    
    // Set response headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=database_backup_${Date.now()}.json`);
    res.json(exportData);
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  } finally {
    client.release();
  }
});

// Admin endpoint: Export specific table as CSV
app.get('/api/admin/export-table/:tableName', async (req, res) => {
  const client = await db.getClient();
  try {
    const { tableName } = req.params;
    console.log(`📋 Exporting table: ${tableName}`);
    
    // Verify table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      )
    `, [tableName]);
    
    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({ error: `Table "${tableName}" not found` });
    }
    
    // Get data
    const dataResult = await client.query(`SELECT * FROM "${tableName}" ORDER BY 1`);
    const data = dataResult.rows;
    
    if (data.length === 0) {
      return res.json({ tableName, rowCount: 0, data: [] });
    }
    
    // Convert to CSV
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        let cell = row[header];
        if (cell === null || cell === undefined) return '';
        if (cell instanceof Date) return cell.toISOString();
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      });
      csvRows.push(values.join(','));
    }
    
    const csv = csvRows.join('\n');
    
    // Send as CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${tableName}_${Date.now()}.csv`);
    res.send(csv);
    
    console.log(`✅ Exported ${tableName}: ${data.length} rows as CSV`);
    
  } catch (error) {
    console.error('❌ Table export failed:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  } finally {
    client.release();
  }
});

// ==================== AUTHENTICATION API ENDPOINTS ====================

// Login endpoint - creates server-side session with auto role detection
app.post('/api/auth/login', async (req, res) => {
  const client = await db.getClient();
  try {
    const { email, password, name } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    let userId = null;
    let userName = name || email;
    let userRole = 'operator'; // default
    let useNewStructure = false;
    
    // FIRST: Check in Supervisors table
    try {
      const supervisorResult = await client.query(
        `SELECT supervisor_id, name, email, password_hash FROM "Supervisors" WHERE email = $1`,
        [email]
      );
      
      if (supervisorResult.rows.length > 0) {
        const supervisor = supervisorResult.rows[0];
        
        // Check password (plain text for now)
        if (password && supervisor.password_hash === password) {
          userId = supervisor.supervisor_id;
          userName = supervisor.name;
          userRole = 'supervisor';
          useNewStructure = true;
          
          console.log('✅ Supervisor login successful:', userId);
        } else if (!password) {
          // No password validation needed for now
          userId = supervisor.supervisor_id;
          userName = supervisor.name;
          userRole = 'supervisor';
          useNewStructure = true;
        }
      }
    } catch (err) {
      console.log('Supervisors table check failed:', err.message);
    }
    
    // SECOND: If not supervisor, check Operators table
    if (!userId) {
      try {
        const operatorResult = await client.query(
          `SELECT operator_id, name, email FROM "Operators" WHERE email = $1`,
          [email]
        );
        
        if (operatorResult.rows.length > 0) {
          // Operator found in new structure
          const operator = operatorResult.rows[0];
          userId = operator.operator_id;
          userName = operator.name;
          userRole = 'operator';
          useNewStructure = true;
          
          // Update last login
          await client.query(
            `UPDATE "Operators" SET last_login = CURRENT_TIMESTAMP WHERE operator_id = $1`,
            [userId]
          );
          
          console.log('✅ Operator login successful:', userId);
        } else {
          // Operators table exists but user not found - allow session-only login
          console.log('User not found in Operators table, creating session-only login');
          userId = email;
        }
      } catch (err) {
        // Operators table doesn't exist - use session-only auth
        console.log('Operators table not found, using session-only auth:', err.message);
        userId = email;
      }
    }
    
    const sessionResult = await sessions.createSession(email, userName, userId);
    
    if (!sessionResult.success) {
      console.error('Failed to create session:', sessionResult.error);
      return res.status(500).json({ error: 'Failed to create session: ' + sessionResult.error });
    }
    
    res.json({
      success: true,
      user: {
        operatorId: userId,
        email: email,
        name: userName,
        role: userRole, // Auto-detected role
        loggedIn: true
      },
      sessionToken: sessionResult.sessionToken,
      expiresAt: sessionResult.expiresAt
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Signup endpoint - creates server-side session with auto-generated operator ID
app.post('/api/auth/signup', async (req, res) => {
  const client = await db.getClient();
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    await client.query('BEGIN');
    
    // Check if Operators table exists (new structure)
    let useNewStructure = false;
    let operatorId = null;
    
    try {
      // Check if email already exists
      const existingCheck = await client.query(
        `SELECT operator_id FROM "Operators" WHERE email = $1`,
        [email]
      );
      
      if (existingCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Email already registered' });
      }
      
      // Get the next operator ID by counting existing operators
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM "Operators"`
      );
      const nextNumber = parseInt(countResult.rows[0].count) + 1;
      operatorId = `OP${String(nextNumber).padStart(3, '0')}`; // OP001, OP002, etc.
      
      // Insert new operator
      await client.query(
        `INSERT INTO "Operators" (operator_id, name, email, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, 'operator', CURRENT_TIMESTAMP)`,
        [operatorId, name, email, password] // In production, hash the password
      );
      
      useNewStructure = true;
    } catch (err) {
      console.log('Operators table not found, using session-only auth');
      useNewStructure = false;
      operatorId = email; // Fallback to email as ID
    }
    
    await client.query('COMMIT');
    
    // Create session
    const sessionResult = await sessions.createSession(email, name, operatorId);
    
    if (!sessionResult.success) {
      console.error('Failed to create session during signup:', sessionResult.error);
      return res.status(500).json({ 
        error: 'Failed to create session: ' + sessionResult.error 
      });
    }
    
    res.json({
      success: true,
      user: {
        operatorId: operatorId,
        email: email,
        name: name,
        loggedIn: true
      },
      sessionToken: sessionResult.sessionToken,
      expiresAt: sessionResult.expiresAt
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during signup:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Logout endpoint - invalidates session
app.post('/api/auth/logout', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
      return res.status(400).json({ error: 'Session token is required' });
    }
    
    await sessions.invalidateSession(sessionToken);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate session endpoint
app.post('/api/auth/validate', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
      return res.status(400).json({ valid: false, reason: 'Session token is required' });
    }
    
    const validation = await sessions.validateSession(sessionToken);
    
    if (validation.valid) {
      res.json({
        valid: true,
        user: {
          email: validation.session.user_identifier,
          name: validation.session.user_name,
          operatorId: validation.session.operator_id,
          loggedIn: true
        },
        expiresAt: validation.session.expires_at
      });
    } else {
      res.json({
        valid: false,
        reason: validation.reason
      });
    }
  } catch (error) {
    console.error('Error validating session:', error);
    res.status(500).json({ valid: false, reason: error.message });
  }
});

// ==================== INVENTORY API ENDPOINTS ====================

// Task History - Log task completion
app.post('/api/tasks/complete', async (req, res) => {
  const client = await db.getClient();
  try {
    const { sessionToken, taskType, sku, quantity, binsUsed, startedAt } = req.body;
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Session token is required' });
    }
    
    // Validate session and get operator info
    const validation = await sessions.validateSession(sessionToken);
    if (!validation.valid) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    const operatorId = validation.session.operator_id;
    const operatorName = validation.session.user_name;
    
    if (!operatorId) {
      return res.status(400).json({ error: 'Operator ID not found in session' });
    }
    
    // Generate task ID
    const taskId = `TASK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate duration
    const startTime = new Date(startedAt);
    const completedAt = new Date();
    const durationMinutes = Math.round((completedAt - startTime) / 60000);
    
    // Insert into Task_History
    const result = await client.query(
      `INSERT INTO "Task_History" 
       (task_id, operator_id, operator_name, task_type, sku, quantity, bins_used, status, started_at, completed_at, duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8, $9, $10)
       RETURNING *`,
      [taskId, operatorId, operatorName, taskType, sku, quantity, binsUsed, startTime, completedAt, durationMinutes]
    );
    
    res.json({
      success: true,
      taskHistory: result.rows[0],
      message: 'Task logged successfully'
    });
  } catch (error) {
    console.error('Error logging task completion:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Task History - Get all task history (for dashboard)
app.get('/api/task-history', async (req, res) => {
  const client = await db.getClient();
  try {
    const { sessionToken, operatorId, taskType, startDate, endDate, limit = 100 } = req.query;
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Session token is required' });
    }
    
    // Validate session
    let validation;
    try {
      validation = await sessions.validateSession(sessionToken);
    } catch (sessionError) {
      console.error('Session validation error:', sessionError);
      return res.status(500).json({ error: 'Session validation failed: ' + sessionError.message });
    }
    
    if (!validation.valid) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    // Check if Task_History table exists, if not return empty array
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'Task_History'
        );
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.log('Task_History table does not exist yet');
        return res.json({
          success: true,
          taskHistory: [],
          count: 0,
          message: 'No tasks recorded yet'
        });
      }
    } catch (tableError) {
      console.error('Error checking Task_History table:', tableError);
    }
    
    // Build query with filters
    let query = `SELECT * FROM "Task_History" WHERE 1=1`;
    const params = [];
    let paramCount = 1;
    
    if (operatorId) {
      query += ` AND operator_id = $${paramCount}`;
      params.push(operatorId);
      paramCount++;
    }
    
    if (taskType) {
      query += ` AND task_type = $${paramCount}`;
      params.push(taskType);
      paramCount++;
    }
    
    if (startDate) {
      query += ` AND completed_at >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }
    
    if (endDate) {
      query += ` AND completed_at <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }
    
    query += ` ORDER BY completed_at DESC LIMIT $${paramCount}`;
    params.push(limit);
    
    console.log('Executing task history query:', query);
    console.log('With params:', params);
    
    const result = await client.query(query, params);
    
    console.log(`✅ Task history fetched: ${result.rows.length} records`);
    
    res.json({
      success: true,
      taskHistory: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('❌ Error fetching task history:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message, details: error.stack });
  } finally {
    client.release();
  }
});

// Get bins with quantity greater than specified value for a SKU
app.post('/api/search-bins', async (req, res) => {
  const client = await db.getClient();
  try {
    const { sku, value } = req.body;
    const minValue = parseInt(value) || 0;
    
    // Get all bins with this SKU
    const result = await client.query(
      `SELECT bin_no, sku, cfc, qty
       FROM "Inventory"
       WHERE sku = $1 AND cfc > $2
       ORDER BY bin_no`,
      [sku, minValue]
    );
    
    // Get currently reserved bins from active tasks (created within last 30 minutes)
    const reservedBinsResult = await client.query(`
      SELECT bin_no, SUM(
        CAST(SPLIT_PART(SPLIT_PART(bin_no, ':', 2), ',', 1) AS INTEGER)
      ) as reserved_qty
      FROM (
        SELECT UNNEST(string_to_array(bin_no, ',')) as bin_no
        FROM tasks
        WHERE status = 'ongoing' 
        AND sku = $1
        AND created_at > NOW() - INTERVAL '1 minute'
      ) t
      WHERE bin_no LIKE '%:%'
      GROUP BY SPLIT_PART(bin_no, ':', 1)
    `, [sku]);
    
    // Create map of reserved quantities per bin
    const reservedMap = new Map();
    reservedBinsResult.rows.forEach(row => {
      const binId = row.bin_no.split(':')[0];
      reservedMap.set(binId, parseInt(row.reserved_qty) || 0);
    });
    
    // Adjust available quantities by subtracting reserved amounts
    const binMap = new Map();
    result.rows.forEach(row => {
      const reservedQty = reservedMap.get(row.bin_no) || 0;
      const availableQty = row.cfc - reservedQty;
      
      // Only include bins with available quantity after reservation
      if (availableQty > minValue) {
        if (!binMap.has(row.bin_no)) {
          binMap.set(row.bin_no, { 'Bin No.': row.bin_no });
        }
        const bin = binMap.get(row.bin_no);
        bin[row.sku] = availableQty; // Show available quantity, not total
        
        // Add indicator if bin is partially reserved
        if (reservedQty > 0) {
          bin['_reserved'] = reservedQty;
          bin['_total'] = row.cfc;
        }
      }
    });
    
    res.json(Array.from(binMap.values()));
  } catch (error) {
    console.error('Error searching bins:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get all SKU columns
app.get('/api/skus', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sku FROM active_skus WHERE is_active = true ORDER BY sku`
    );
    
    const skus = result.rows.map(row => row.sku);
    res.json(skus);
  } catch (error) {
    console.error('Error fetching SKUs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate QR code for bin
app.post('/api/generate-qr', async (req, res) => {
  try {
    const { binNo, sku, value } = req.body;
    const scanUrl = `http://${LOCAL_IP}:${PORT}/scan.html?binNo=${encodeURIComponent(binNo)}&sku=${encodeURIComponent(sku)}&value=${value}`;
    const qrCodeUrl = await QRCode.toDataURL(scanUrl);
    res.json({ qrCode: qrCodeUrl });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process QR code scan (subtract value from bin)
app.post('/api/process-scan', async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { binNo, sku, value } = req.body;
    
    await client.query('BEGIN');
    
    // Find the row with matching bin and SKU
    const inventoryResult = await client.query(
      `SELECT * FROM "Inventory" WHERE bin_no = $1 AND sku = $2`,
      [binNo, sku]
    );
    
    if (inventoryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bin with SKU not found' });
    }
    
    const currentRow = inventoryResult.rows[0];
    const currentCFC = currentRow.cfc;
    const uom = currentRow.uom;
    
    const newCFC = Math.max(0, currentCFC - parseInt(value));
    const newQTY = newCFC * uom;
    
    // UPDATE "Inventory"
    await client.query(
      `UPDATE "Inventory" 
       SET cfc = $1, qty = $2, updated_at = CURRENT_TIMESTAMP
       WHERE bin_no = $3 AND sku = $4`,
      [newCFC, newQTY, binNo, sku]
    );
    
    // Log transaction
    await client.query(
      `INSERT INTO transactions (transaction_type, bin_id, sku, quantity, previous_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['outgoing', binNo, sku, parseInt(value), currentCFC, newCFC]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      binNo, 
      sku, 
      previousValue: currentCFC, 
      newValue: newCFC,
      subtracted: value 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing scan:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get current inventory status
app.get('/api/inventory', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT bin_no, sku, cfc, qty FROM "Inventory" ORDER BY bin_no, sku`
    );
    
    // Convert to old format for compatibility
    const binMap = new Map();
    result.rows.forEach(row => {
      if (!binMap.has(row.bin_no)) {
        binMap.set(row.bin_no, { 'Bin No.': row.bin_no });
      }
      const bin = binMap.get(row.bin_no);
      bin[row.sku] = row.cfc;
    });
    
    res.json(Array.from(binMap.values()));
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== FRONTEND API ENDPOINTS ====================

// Get all available SKUs
app.get('/api/sku-list', async (req, res) => {
  const client = await db.getClient();
  try {
    // Check if active_skus table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'active_skus'
      );
    `);
    
    let result;
    
    if (tableCheck.rows[0].exists) {
      // Use active_skus table to filter
      result = await client.query(
        `SELECT sku FROM active_skus WHERE is_active = true ORDER BY sku`
      );
      console.log(`✅ Returned ${result.rows.length} active SKUs from active_skus table`);
    } else {
      // Fallback to all SKUs from master file if active_skus doesn't exist
      try {
        result = await client.query(
          `SELECT DISTINCT sku FROM "Cleaned_FG_Master_file" ORDER BY sku`
        );
        console.log(`⚠️ active_skus table not found, returned all ${result.rows.length} SKUs from master file`);
      } catch (err) {
        console.error('Error fetching SKUs:', err);
        return res.status(500).json({ error: 'No SKU source available' });
      }
    }
    
    const skus = result.rows.map(row => row.sku);
    res.json({ skus });
  } catch (error) {
    console.error('Error fetching SKU list:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get SKU details (description, UOM)
app.get('/api/sku-details/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    let result;
    
    try {
      // Try new table first
      result = await db.query(
        `SELECT sku, description, uom FROM "Cleaned_FG_Master_file" WHERE sku = $1`,
        [sku]
      );
    } catch (err) {
      // Fallback: Get from inventory table (old structure)
      console.log('Cleaned_FG_Master_file not found, getting from inventory');
      result = await db.query(
        `SELECT DISTINCT sku, description, uom FROM inventory WHERE sku = $1 LIMIT 1`,
        [sku]
      );
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'SKU not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching SKU details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available bins for incoming inventory
app.get('/api/bins/available', async (req, res) => {
  try {
    const { sku, taskType } = req.query; // taskType = 'incoming' or 'outgoing'
    
    let inventoryResult, emptyBinsResult, lockedBins = [];
    
    // Get locked bins (bins with pending tasks for this task type)
    if (taskType) {
      const lockedResult = await db.query(`
        SELECT DISTINCT bin_no
        FROM "Pending_Tasks"
        WHERE task_type = $1 AND status = 'pending' AND expires_at > NOW()
      `, [taskType]);
      
      lockedBins = lockedResult.rows.map(r => r.bin_no);
      console.log(`🔒 Locked bins for ${taskType}:`, lockedBins);
    }
    
    // Try new table structure first
    try {
      // Get bins with the requested SKU from Inventory (grouped by bin_no to combine batches)
      inventoryResult = await db.query(
        `SELECT bin_no, sku, SUM(cfc) as cfc, MIN(created_at) as created_at
         FROM "Inventory" 
         WHERE sku = $1 
         GROUP BY bin_no, sku
         ORDER BY MIN(created_at) ASC`,
        [sku]
      );
      
      // Get all empty bins from Bins table (bins not in Inventory for any SKU)
      emptyBinsResult = await db.query(
        `SELECT b.bin_no 
         FROM "Bins" b
         WHERE NOT EXISTS (
           SELECT 1 FROM "Inventory" i WHERE i.bin_no = b.bin_no
         )
         ORDER BY b.bin_no`
      );
    } catch (err) {
      // Fallback to old table structure
      console.log('New tables not found, using old inventory table');
      inventoryResult = await db.query(
        `SELECT bin_no, sku, SUM(cfc) as cfc, MIN(created_at) as created_at
         FROM inventory 
         WHERE sku = $1 
         GROUP BY bin_no, sku
         ORDER BY MIN(created_at) ASC`,
        [sku]
      );
      emptyBinsResult = { rows: [] }; // No separate bins table in old structure
    }
    
    const partialBins = [];
    const fullBins = [];
    const emptyBins = [];
    const capacity = 240; // Maximum capacity per bin (240 CFC)
    
    // Process bins from Inventory (same SKU, grouped by bin)
    // FILTER OUT LOCKED BINS
    inventoryResult.rows.forEach(row => {
      // Skip locked bins
      if (lockedBins.includes(row.bin_no)) {
        console.log(`⏭️ Skipping locked bin: ${row.bin_no}`);
        return;
      }
      
      const currentQty = row.cfc; // Now this is SUM of all batches in this bin
      const available = capacity - currentQty;
      
      const binData = {
        id: row.bin_no,
        sku: sku,
        current: currentQty,
        capacity: capacity,
        available: Math.max(0, available)
        // batch field removed because multiple batches are combined
      };
      
      if (currentQty === 0) {
        emptyBins.push(binData);
      } else if (currentQty > 0 && currentQty < capacity) {
        partialBins.push(binData);
      } else if (currentQty >= capacity) {
        fullBins.push(binData);
      }
    });
    
    // Add completely empty bins (not in Inventory at all)
    // FILTER OUT LOCKED BINS
    emptyBinsResult.rows.forEach(row => {
      // Skip locked bins
      if (lockedBins.includes(row.bin_no)) {
        console.log(`⏭️ Skipping locked empty bin: ${row.bin_no}`);
        return;
      }
      
      emptyBins.push({
        id: row.bin_no,
        sku: null,
        current: 0,
        capacity: capacity,
        available: capacity,
        batch: null
      });
    });
    
    res.json({ partialBins, fullBins, emptyBins });
  } catch (error) {
    console.error('Error fetching available bins:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get bins in FIFO order for outgoing
app.get('/api/bins/fifo', async (req, res) => {
  try {
    const { sku, batch } = req.query;
    
    // Build query based on whether batch is provided
    let query;
    let params;
    
    if (batch) {
      // Filter by both SKU and batch number
      query = `SELECT bin_no, sku, cfc, batch_no, created_at
               FROM "Inventory"
               WHERE sku = $1 AND batch_no = $2
               ORDER BY created_at ASC`;
      params = [sku, batch];
    } else {
      // Filter by SKU only (backward compatibility)
      query = `SELECT bin_no, sku, cfc, batch_no, created_at
               FROM "Inventory"
               WHERE sku = $1
               ORDER BY created_at ASC`;
      params = [sku];
    }
    
    const result = await db.query(query, params);
    
    const bins = result.rows.map(row => {
      let daysOld = 0;
      let date = row.created_at;
      
      if (date) {
        const today = new Date();
        daysOld = Math.floor((today - new Date(date)) / (1000 * 60 * 60 * 24));
      } else {
        // Parse batch number for date
        daysOld = Math.floor(Math.random() * 60) + 1;
        date = new Date();
        date.setDate(date.getDate() - daysOld);
        
        if (row.batch_no) {
          const match = row.batch_no.match(/(\d{2})([A-Z]{3})(\d{2})/);
          if (match) {
            const day = parseInt(match[1]);
            const monthMap = {
              'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
              'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
            };
            const month = monthMap[match[2]];
            const year = 2000 + parseInt(match[3]);
            
            if (month !== undefined) {
              date = new Date(year, month, day);
              const today = new Date();
              daysOld = Math.floor((today - date) / (1000 * 60 * 60 * 24));
            }
          }
        }
      }
      
      return {
        id: row.bin_no,
        sku: row.sku,
        quantity: row.cfc,
        date: date instanceof Date ? date.toISOString().split('T')[0] : date,
        daysOld: daysOld,
        batch: row.batch_no
      };
    });
    
    // Sort by date (oldest first - FIFO)
    bins.sort((a, b) => b.daysOld - a.daysOld);
    
    res.json({ bins });
  } catch (error) {
    console.error('Error fetching FIFO bins:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PENDING TASKS APIs ====================

// Create pending task (when user presses back during incoming/outgoing)
app.post('/api/pending-tasks/create', async (req, res) => {
  const client = await db.getClient();
  try {
    const { operatorId, taskType, sku, binNo, cfc, weight, batchNo } = req.body;
    
    // Only operatorId, taskType, and sku are required
    // binNo can be null if task is saved before bin selection
    if (!operatorId || !taskType || !sku) {
      return res.status(400).json({ error: 'Missing required fields: operatorId, taskType, sku' });
    }
    
    // Set expiration time (30 minutes from now)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    
    const result = await client.query(`
      INSERT INTO "Pending_Tasks" (operator_id, task_type, sku, bin_no, cfc, weight, batch_no, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [operatorId, taskType, sku, binNo || null, cfc || null, weight || null, batchNo || null, expiresAt]);
    
    console.log(`✅ Pending task created: ${taskType} - ${sku} (${cfc || 0} CFC, Bin: ${binNo || 'Not selected'})`);
    
    res.json({
      success: true,
      task: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error creating pending task:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get operator's pending tasks
app.get('/api/pending-tasks/list', async (req, res) => {
  const client = await db.getClient();
  try {
    const { operatorId } = req.query;
    
    if (!operatorId) {
      return res.status(400).json({ error: 'Operator ID required' });
    }
    
    // First, auto-expire old tasks
    await client.query(`
      UPDATE "Pending_Tasks"
      SET status = 'expired'
      WHERE status = 'pending' AND expires_at < NOW()
    `);
    
    // Get active pending tasks
    const result = await client.query(`
      SELECT *, 
        EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_remaining
      FROM "Pending_Tasks"
      WHERE operator_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
    `, [operatorId]);
    
    res.json({
      success: true,
      tasks: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching pending tasks:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Complete pending task
app.post('/api/pending-tasks/complete', async (req, res) => {
  const client = await db.getClient();
  try {
    const { taskId } = req.body;
    
    await client.query(`
      UPDATE "Pending_Tasks"
      SET status = 'completed'
      WHERE id = $1
    `, [taskId]);
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Delete/Cancel pending task
app.post('/api/pending-tasks/cancel', async (req, res) => {
  const client = await db.getClient();
  try {
    const { taskId } = req.body;
    
    await client.query(`
      DELETE FROM "Pending_Tasks" WHERE id = $1
    `, [taskId]);
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error cancelling task:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ==================== BIN UPDATE ====================

// Update bin after incoming
app.post('/api/bins/update', async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { binId, sku, quantity, weight } = req.body;
    
    await client.query('BEGIN');
    
    let description = '';
    let uom = parseFloat(weight) || 2.0;
    let useNewStructure = false;
    
    // Try to fetch SKU details from Cleaned_FG_Master_file (new structure)
    let expireInDays = null;
    try {
      const skuResult = await client.query(
        `SELECT description, uom, expire_in_days FROM "Cleaned_FG_Master_file" WHERE sku = $1`,
        [sku]
      );
      
      if (skuResult.rows.length > 0) {
        description = skuResult.rows[0].description;
        uom = skuResult.rows[0].uom;
        expireInDays = skuResult.rows[0].expire_in_days;
        useNewStructure = true;
      }
    } catch (err) {
      console.log('Cleaned_FG_Master_file not found, using old structure');
      useNewStructure = false;
    }
    
    let currentCFC = 0;
    let newCFC = parseInt(quantity);
    
    if (useNewStructure) {
      // NEW STRUCTURE: Use "Inventory" table with batch-based logic
      // Generate today's batch number
      const todayBatch = generateBatchNumber();
      
      // Check if this bin + today's batch already exists
      const existingBatchResult = await client.query(
        `SELECT * FROM "Inventory" WHERE bin_no = $1 AND batch_no = $2`,
        [binId, todayBatch]
      );
      
      if (existingBatchResult.rows.length > 0) {
        // Today's batch exists in this bin - update it
        currentCFC = existingBatchResult.rows[0].cfc;
        newCFC = currentCFC + parseInt(quantity);
        
        await client.query(
          `UPDATE "Inventory" 
           SET cfc = $1, updated_at = CURRENT_TIMESTAMP
           WHERE bin_no = $2 AND batch_no = $3`,
          [newCFC, binId, todayBatch]
        );
        
        // Log to Incoming table
        await client.query(
          `INSERT INTO "Incoming" (sku, batch_no, description, quantity, weight, uom, bin_no, operator_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [sku, todayBatch, description, parseInt(quantity), weight, uom, binId, null]
        );
      } else {
        // Today's batch doesn't exist in this bin - create new row
        newCFC = parseInt(quantity);
        
        await client.query(
          `INSERT INTO "Inventory" (bin_no, sku, batch_no, cfc, description, uom, expire_days)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [binId, sku, todayBatch, newCFC, description, uom, expireInDays]
        );
        
        // Also log to Incoming table
        await client.query(
          `INSERT INTO "Incoming" (sku, batch_no, description, quantity, weight, uom, bin_no, operator_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [sku, todayBatch, description, parseInt(quantity), weight, uom, binId, null]
        );
      }
    } else {
      // OLD STRUCTURE: Use inventory table
      const existingResult = await client.query(
        `SELECT * FROM inventory WHERE bin_no = $1 AND sku = $2`,
        [binId, sku]
      );
      
      if (existingResult.rows.length > 0) {
        // Update existing row
        currentCFC = existingResult.rows[0].cfc;
        newCFC = currentCFC + parseInt(quantity);
        
        await client.query(
          `UPDATE inventory 
           SET cfc = $1, qty = $2, uom = $3, updated_at = CURRENT_TIMESTAMP
           WHERE bin_no = $4 AND sku = $5`,
          [newCFC, newCFC * uom, uom, binId, sku]
        );
      } else {
        // Insert new row with new batch format: Z05NOV25
        const batchNo = generateBatchNumber();
        
        await client.query(
          `INSERT INTO inventory (bin_no, sku, batch_no, cfc, uom, qty)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [binId, sku, batchNo, newCFC, uom, newCFC * uom]
        );
      }
    }
    
    // Log transaction
    await client.query(
      `INSERT INTO transactions (transaction_type, bin_id, sku, quantity, previous_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['incoming', binId, sku, parseInt(quantity), currentCFC, newCFC]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true,
      binId,
      sku,
      previousValue: currentCFC,
      newValue: newCFC
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating bin:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Dispatch bin for outgoing
app.post('/api/bins/dispatch', async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { binId, sku, quantity, batch } = req.body;
    
    await client.query('BEGIN');
    
    // Find the row
    const result = await client.query(
      `SELECT * FROM "Inventory" WHERE bin_no = $1 AND sku = $2`,
      [binId, sku]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bin with SKU not found' });
    }
    
    const currentRow = result.rows[0];
    const currentCFC = currentRow.cfc;
    const uom = currentRow.uom;
    
    const newCFC = Math.max(0, currentCFC - parseInt(quantity));
    const newQTY = newCFC * uom;
    
    // UPDATE "Inventory"
    await client.query(
      `UPDATE "Inventory" 
       SET cfc = $1, qty = $2, updated_at = CURRENT_TIMESTAMP
       WHERE bin_no = $3 AND sku = $4`,
      [newCFC, newQTY, binId, sku]
    );
    
    // Log to Outgoing table
    await client.query(
      `INSERT INTO "Outgoing" (sku, batch_no, description, quantity, weight, uom, bin_no, operator_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sku, batch, currentRow.description, parseInt(quantity), null, uom, binId, null]
    );
    
    // Log transaction
    await client.query(
      `INSERT INTO transactions (transaction_type, bin_id, sku, quantity, batch_no, previous_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['outgoing', binId, sku, parseInt(quantity), batch, currentCFC, newCFC]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true,
      binId,
      sku,
      dispatched: quantity,
      remaining: newCFC
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error dispatching bin:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get expiry reminders for dashboard
app.get('/api/inventory/expiry-reminders', async (req, res) => {
  try {
    const filter = req.query.filter || '15'; // '15' or 'all'
    
    let query = `
      SELECT 
        id, bin_no, sku, batch_no, cfc, description, uom, expire_days
      FROM "Inventory"
      WHERE expire_days IS NOT NULL AND cfc > 0
    `;
    
    // Filter by last 15 days if specified
    if (filter === '15') {
      query += ` AND expire_days <= 15`;
    }
    
    query += ` ORDER BY expire_days ASC`;
    
    const result = await db.query(query);
    
    res.json({
      success: true,
      items: result.rows,
      count: result.rows.length,
      filter: filter
    });
  } catch (error) {
    console.error('Error fetching expiry reminders:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get dashboard summary
app.get('/api/reports/summary', async (req, res) => {
  try {
    const totalCartonsResult = await db.query(
      `SELECT COALESCE(SUM(cfc), 0) as total FROM "Inventory"`
    );
    
    const activeBinsResult = await db.query(
      `SELECT COUNT(DISTINCT bin_no) as count FROM "Inventory" WHERE cfc > 0`
    );
    
    const emptyBinsResult = await db.query(
      `SELECT COUNT(DISTINCT bin_no) as count FROM "Inventory" WHERE cfc = 0`
    );
    
    const skuTypesResult = await db.query(
      `SELECT COUNT(DISTINCT sku) as count FROM "Inventory" WHERE cfc > 0`
    );
    
    const totalBinsResult = await db.query(
      `SELECT COUNT(DISTINCT bin_no) as count FROM "Inventory"`
    );
    
    res.json({
      totalUnits: Math.round(parseFloat(totalCartonsResult.rows[0].total)),
      activeBins: parseInt(activeBinsResult.rows[0].count),
      emptyBins: parseInt(emptyBinsResult.rows[0].count),
      skuTypes: parseInt(skuTypesResult.rows[0].count),
      totalBins: parseInt(totalBinsResult.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get activity log
app.get('/api/reports/activity', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 50`
    );
    
    const transactions = result.rows.map(row => ({
      type: row.transaction_type,
      binId: row.bin_id,
      sku: row.sku,
      quantity: row.quantity,
      batch: row.batch_no,
      timestamp: row.timestamp,
      previousValue: row.previous_value,
      newValue: row.new_value
    }));
    
    res.json({ transactions });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SUPERVISOR API ENDPOINTS ====================

// Get active SKU list
app.get('/api/supervisor/active-skus', async (req, res) => {
  const client = await db.getClient();
  try {
    // Check if active_skus table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'active_skus'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      // If table doesn't exist, create it and populate from Cleaned_FG_Master_file
      await client.query(`
        CREATE TABLE IF NOT EXISTS active_skus (
          sku VARCHAR(50) PRIMARY KEY,
          is_active BOOLEAN DEFAULT true
        );
      `);
      
      // Populate with all SKUs from master file
      await client.query(`
        INSERT INTO active_skus (sku, is_active)
        SELECT DISTINCT sku, true
        FROM "Cleaned_FG_Master_file"
        ON CONFLICT (sku) DO NOTHING;
      `);
    }
    
    const allResult = await client.query(`SELECT sku FROM active_skus ORDER BY sku`);
    const activeResult = await client.query(`SELECT sku FROM active_skus WHERE is_active = true ORDER BY sku`);
    
    res.json({
      allSKUs: allResult.rows.map(row => row.sku),
      activeSkus: activeResult.rows.map(row => row.sku)
    });
  } catch (error) {
    console.error('Error fetching active SKUs:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Update active SKU list
app.post('/api/supervisor/active-skus', async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { activeSKUs } = req.body;
    
    if (!Array.isArray(activeSKUs)) {
      return res.status(400).json({ error: 'activeSKUs must be an array' });
    }
    
    await client.query('BEGIN');
    
    // Set all to inactive first
    await client.query(`UPDATE active_skus SET is_active = false`);
    
    // Set selected ones to active
    if (activeSKUs.length > 0) {
      await client.query(
        `UPDATE active_skus SET is_active = true WHERE sku = ANY($1::text[])`,
        [activeSKUs]
      );
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Active SKU list updated',
      activeSKUs: activeSKUs
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating active SKUs:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Sync all SKUs from Cleaned_FG_Master_file to active_skus (force sync)
app.post('/api/admin/sync-active-skus', async (req, res) => {
  const client = await db.getClient();
  
  try {
    console.log('🔄 Syncing all SKUs from Cleaned_FG_Master_file to active_skus...');
    
    // Create table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS active_skus (
        sku VARCHAR(50) PRIMARY KEY,
        is_active BOOLEAN DEFAULT true
      );
    `);
    
    // Insert all SKUs from master file (including FXC1100PB)
    const result = await client.query(`
      INSERT INTO active_skus (sku, is_active)
      SELECT DISTINCT sku, true
      FROM "Cleaned_FG_Master_file"
      ON CONFLICT (sku) DO UPDATE SET is_active = true
      RETURNING sku
    `);
    
    console.log(`✅ Synced ${result.rowCount} SKUs to active_skus table`);
    
    res.json({
      success: true,
      message: `Successfully synced ${result.rowCount} SKUs`,
      count: result.rowCount
    });
    
  } catch (error) {
    console.error('❌ Error syncing SKUs:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  } finally {
    client.release();
  }
});

// Supervisor endpoint to create operator accounts
app.post('/api/supervisor/create-operator', async (req, res) => {
  const client = await db.getClient();
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    await client.query('BEGIN');
    
    // Check if email already exists (prevent duplicate accounts)
    const existingCheck = await client.query(
      `SELECT operator_id, role FROM "Operators" WHERE email = $1`,
      [email]
    );
    
    if (existingCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      const existingRole = existingCheck.rows[0].role;
      return res.status(400).json({ 
        error: `This email is already registered as ${existingRole}. Cannot create duplicate account.`
      });
    }
    
    // Get the next operator ID
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM "Operators" WHERE role = 'operator'`
    );
    const nextNumber = parseInt(countResult.rows[0].count) + 1;
    const operatorId = `OP${String(nextNumber).padStart(3, '0')}`; // OP001, OP002, etc.
    
    // Insert new operator (only operators, not supervisors)
    await client.query(
      `INSERT INTO "Operators" (operator_id, name, email, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, 'operator', CURRENT_TIMESTAMP)`,
      [operatorId, name, email, password] // In production, hash the password
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Operator account created successfully',
      operatorId: operatorId,
      email: email,
      name: name
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating operator:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get all tasks
app.get('/api/supervisor/tasks', async (req, res) => {
  try {
    const ongoingResult = await db.query(
      `SELECT * FROM tasks WHERE status = 'ongoing' ORDER BY created_at DESC`
    );
    
    const completedResult = await db.query(
      `SELECT * FROM tasks WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 50`
    );
    
    const cancelledResult = await db.query(
      `SELECT * FROM tasks WHERE status = 'cancelled' ORDER BY cancelled_at DESC LIMIT 50`
    );
    
    const formatTask = (row) => {
      // Calculate progress for ongoing tasks
      let progress = null;
      if (row.status === 'ongoing' && row.bin_no && row.scanned_bins) {
        const totalBins = row.bin_no.split(',').filter(Boolean).length;
        const scannedCount = row.scanned_bins.split(',').filter(Boolean).length;
        progress = {
          scannedBins: scannedCount,
          totalBins: totalBins,
          percentage: totalBins > 0 ? Math.round((scannedCount / totalBins) * 100) : 0
        };
      }
      
      return {
        id: row.id,
        operator: row.operator,
        sku: row.sku,
        binNo: row.bin_no,
        quantity: row.quantity,
        type: row.task_type,
        status: row.status,
        timestamp: row.created_at,
        startTime: row.created_at,
        endTime: row.completed_at,
        cancelReason: row.cancel_reason,
        cancelledBy: row.cancelled_by,
        cancelledAt: row.cancelled_at,
        reason: row.cancel_reason,
        progress: progress
      };
    };
    
    res.json({
      ongoing: ongoingResult.rows.map(formatTask),
      completed: completedResult.rows.map(formatTask),
      cancelled: cancelledResult.rows.map(formatTask)
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel a task
app.post('/api/supervisor/cancel-task', async (req, res) => {
  try {
    const { taskId, reason, cancelledBy } = req.body;
    
    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }
    
    const result = await db.query(
      `UPDATE tasks 
       SET status = 'cancelled', 
           cancel_reason = $1, 
           cancelled_by = $2,
           cancelled_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND status = 'ongoing'
       RETURNING *`,
      [reason || 'No reason provided', cancelledBy || 'Supervisor', taskId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or cannot be cancelled' });
    }
    
    res.json({
      success: true,
      message: 'Task cancelled successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Error cancelling task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new task
app.post('/api/tasks/create', async (req, res) => {
  try {
    const { operator, sku, binNo, quantity, type, sessionToken } = req.body;
    
    if (!operator || !sku || !binNo || !quantity || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Ensure tasks table has session_token column (backwards-compatible)
    try {
      await db.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS session_token VARCHAR(255)`);
      await db.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reserved_qty INTEGER DEFAULT 0`);
    } catch (err) {
      console.warn('Could not add columns (may already exist):', err.message);
    }

    const result = await db.query(
      `INSERT INTO tasks (operator, sku, bin_no, quantity, reserved_qty, task_type, status, session_token)
       VALUES ($1, $2, $3, $4, $5, $6, 'ongoing', $7)
       RETURNING *`,
      [operator, sku, binNo, parseInt(quantity), parseInt(quantity), type, sessionToken || null]
    );
    
    res.json({
      success: true,
      task: {
        id: result.rows[0].id,
        operator: result.rows[0].operator,
        sku: result.rows[0].sku,
        binNo: result.rows[0].bin_no,
        quantity: result.rows[0].quantity,
        type: result.rows[0].task_type,
        status: result.rows[0].status,
        timestamp: result.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete a task
app.post('/api/tasks/complete', async (req, res) => {
  try {
    const { taskId } = req.body;
    
    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }
    
    // Check if task is cancelled
    const checkResult = await db.query(
      `SELECT status FROM tasks WHERE id = $1`,
      [taskId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (checkResult.rows[0].status === 'cancelled') {
      return res.status(400).json({ 
        error: 'This task has been cancelled by supervisor',
        cancelled: true
      });
    }
    
    const result = await db.query(
      `UPDATE tasks 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'ongoing'
       RETURNING *`,
      [taskId]
    );
    
    res.json({
      success: true,
      message: 'Task completed successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel a task (manual or auto-cancel)
app.post('/api/tasks/cancel', async (req, res) => {
  const client = await db.getClient();
  try {
    const { taskId, reason } = req.body;
    
    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required' });
    }
    
    await client.query('BEGIN');
    
    // Get task details before cancellation
    const taskDetails = await client.query(
      `SELECT * FROM tasks WHERE id = $1 AND status = 'ongoing'`,
      [taskId]
    );
    
    if (taskDetails.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found or already completed/cancelled' });
    }
    
    const task = taskDetails.rows[0];
    
    // Update task status to cancelled
    const result = await client.query(
      `UPDATE tasks 
       SET status = 'cancelled', 
           cancelled_at = CURRENT_TIMESTAMP,
           cancellation_reason = $2
       WHERE id = $1 AND status = 'ongoing'
       RETURNING *`,
      [taskId, reason || 'Cancelled by user']
    );
    
    // Add to Task_History as incomplete/cancelled task
    await client.query(
      `INSERT INTO "Task_History" (
        task_id, operator, sku, task_type, status, 
        bins_involved, total_quantity, cancelled_reason,
        created_at, cancelled_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
      [
        task.id,
        task.operator,
        task.sku,
        task.task_type,
        'cancelled',
        task.bin_no || 'N/A',
        task.reserved_qty || 0,
        reason || 'Cancelled by user',
        task.created_at
      ]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Task cancelled successfully',
      task: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling task:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Auto-cancel expired tasks (run periodically)
async function autoCancelExpiredTasks() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    // Get expired tasks before cancelling
    const expiredTasks = await client.query(`
      SELECT * FROM tasks
      WHERE status = 'ongoing'
      AND created_at < NOW() - INTERVAL '1 minute'
    `);
    
    if (expiredTasks.rows.length === 0) {
      await client.query('COMMIT');
      return;
    }
    
    // Cancel expired tasks
    const result = await client.query(`
      UPDATE tasks 
      SET status = 'cancelled',
          cancelled_at = CURRENT_TIMESTAMP,
          cancellation_reason = 'Auto-cancelled: 1-minute timeout exceeded (testing)'
      WHERE status = 'ongoing'
      AND created_at < NOW() - INTERVAL '1 minute'
      RETURNING id, operator, sku
    `);
    
    // Add each cancelled task to Task_History
    for (const task of expiredTasks.rows) {
      await client.query(
        `INSERT INTO "Task_History" (
          task_id, operator, sku, task_type, status, 
          bins_involved, total_quantity, cancelled_reason,
          created_at, cancelled_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
        [
          task.id,
          task.operator,
          task.sku,
          task.task_type,
          'cancelled',
          task.bin_no || 'N/A',
          task.reserved_qty || 0,
          'Auto-cancelled: 1-minute timeout exceeded (testing)',
          task.created_at
        ]
      );
    }
    
    await client.query('COMMIT');
    
    if (result.rows.length > 0) {
      console.log(`✅ Auto-cancelled ${result.rows.length} expired tasks:`, result.rows);
    }
  } catch (error) {
    console.error('❌ Error auto-cancelling expired tasks:', error);
  } finally {
    client.release();
  }
}

// Run auto-cancel check every 5 minutes
setInterval(autoCancelExpiredTasks, 5 * 60 * 1000);

// Run once on startup
setTimeout(autoCancelExpiredTasks, 10000);

// Check if task is cancelled
app.get('/api/tasks/check/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const result = await db.query(
      `SELECT * FROM tasks WHERE id = $1`,
      [parseInt(taskId)]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({
      task: result.rows[0],
      isCancelled: result.rows[0].status === 'cancelled'
    });
  } catch (error) {
    console.error('Error checking task:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== BIN QR CODE GENERATION ====================

// Secure scan-based bin deduction
app.post('/api/bins/scan-deduct', async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { binId, sku, quantity, sessionToken, operator } = req.body;
    
    // Validate required fields
    if (!binId || !sku || !quantity || !sessionToken || !operator) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['binId', 'sku', 'quantity', 'sessionToken', 'operator']
      });
    }
    
    // TODO: Validate session token (in production, store tokens in database)
    // For now, we just check if token exists and has correct format
    if (!sessionToken.startsWith('session_')) {
      return res.status(401).json({ error: 'Invalid session token' });
    }
    
    await client.query('BEGIN');
    
    // Find the bin with SKU
    const result = await client.query(
      `SELECT * FROM "Inventory" WHERE bin_no = $1 AND sku = $2`,
      [binId, sku]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        error: 'Bin with SKU not found',
        binId,
        sku
      });
    }
    
    const currentRow = result.rows[0];
    const currentCFC = currentRow.cfc;
    const uom = currentRow.uom;
    
    // Check if sufficient quantity available
    if (currentCFC < parseInt(quantity)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Insufficient quantity in bin',
        available: currentCFC,
        requested: parseInt(quantity)
      });
    }
    
    const newCFC = Math.max(0, currentCFC - parseInt(quantity));
    const newQTY = newCFC * uom;
    
    // UPDATE "Inventory"
    await client.query(
      `UPDATE "Inventory" 
       SET cfc = $1, qty = $2, updated_at = CURRENT_TIMESTAMP
       WHERE bin_no = $3 AND sku = $4`,
      [newCFC, newQTY, binId, sku]
    );
    
    // Log to Outgoing table
    await client.query(
      `INSERT INTO "Outgoing" (sku, batch_no, description, quantity, weight, uom, bin_no, operator_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sku, currentRow.batch_no, currentRow.description, parseInt(quantity), null, uom, binId, operator]
    );
    
    // Log transaction
    await client.query(
      `INSERT INTO transactions (transaction_type, bin_id, sku, quantity, operator, previous_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['outgoing_scan', binId, sku, parseInt(quantity), operator, currentCFC, newCFC]
    );
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true,
      binId,
      sku,
      operator,
      deducted: parseInt(quantity),
      previousQty: currentCFC,
      remainingQty: newCFC,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in scan-deduct:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Secure scan endpoint: validates sessionToken against task and deducts/adds quantity based on task type
app.post('/api/bins/scan', async (req, res) => {
  const client = await db.getClient();

  try {
    const { binId, taskId, sessionToken } = req.body;

    if (!binId || !taskId || !sessionToken) {
      return res.status(400).json({ error: 'Missing required fields', required: ['binId','taskId','sessionToken'] });
    }

    // Validate session with session management system
    const sessionValidation = await sessions.validateSession(sessionToken);
    if (!sessionValidation.valid) {
      return res.status(401).json({ error: 'Invalid or expired session', reason: sessionValidation.reason });
    }

    // Fetch task
    const taskResult = await client.query(`SELECT * FROM tasks WHERE id = $1`, [parseInt(taskId)]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check if task is cancelled or expired
    if (task.status === 'cancelled') {
      return res.status(400).json({ 
        error: 'Task has been cancelled',
        message: 'This task was cancelled due to timeout or manual cancellation. Please return to dashboard.',
        cancelled: true
      });
    }
    
    // Check if task has expired (more than 1 minute old)
    const taskAge = Date.now() - new Date(task.created_at).getTime();
    const timeoutMs = 1 * 60 * 1000; // 1 minute in milliseconds
    
    if (taskAge > timeoutMs) {
      // Auto-cancel this expired task
      await client.query(
        `UPDATE tasks 
         SET status = 'cancelled', 
             cancelled_at = CURRENT_TIMESTAMP,
             cancellation_reason = 'Auto-cancelled: Task expired before completion'
         WHERE id = $1`,
        [task.id]
      );
      
      // Add to Task_History
      await client.query(
        `INSERT INTO "Task_History" (
          task_id, operator, sku, task_type, status, 
          bins_involved, total_quantity, cancelled_reason,
          created_at, cancelled_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
        [
          task.id,
          task.operator,
          task.sku,
          task.task_type,
          'cancelled',
          task.bin_no || 'N/A',
          task.reserved_qty || 0,
          'Auto-cancelled: Task expired before completion',
          task.created_at
        ]
      );
      
      return res.status(400).json({ 
        error: 'Task has expired',
        message: 'This task has expired. The 1-minute timer ran out. Please return to dashboard.',
        expired: true,
        cancelled: true
      });
    }

    // Normalize task type (DB column is `task_type`; older code may expect `type`)
    const taskType = task.task_type || task.type || taskType;

    // Validate session token matches the task's session_token
    if (!task.session_token || task.session_token !== sessionToken) {
      return res.status(401).json({ error: 'Session token does not match task', detail: 'This task was created by a different user session' });
    }

    // Parse bin list saved on task: format binId:qty,bin2:qty
    const binList = (task.bin_no || '').split(',').map(item => item.trim()).filter(Boolean);
    const binMap = {};
    binList.forEach(pair => {
      const [b, q] = pair.split(':');
      if (b) binMap[b] = parseInt(q) || 0;
    });

    if (!binMap[binId]) {
      return res.status(400).json({ error: 'Bin not part of this task or no quantity assigned for this bin' });
    }

    const qtyToProcess = binMap[binId];
    if (qtyToProcess <= 0) {
      return res.status(400).json({ error: 'No quantity to process for this bin' });
    }

    await client.query('BEGIN');

    // Validate that the bin exists in the Bins table
    let binExists = false;
    try {
      const binCheckNew = await client.query(
        `SELECT bin_no FROM "Bins" WHERE bin_no = $1 LIMIT 1`,
        [binId]
      );
      binExists = binCheckNew.rows.length > 0;
    } catch (err) {
      // Try old bins table
      try {
        const binCheckOld = await client.query(
          `SELECT bin_no FROM bins WHERE bin_no = $1 LIMIT 1`,
          [binId]
        );
        binExists = binCheckOld.rows.length > 0;
      } catch (err2) {
        // No bins table exists, allow any bin
        binExists = true;
      }
    }

    if (!binExists) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Invalid bin',
        message: `Bin ${binId} does not exist in the database. Please scan a valid bin QR code from the registered bins (A01-A08, B01-B07, C01-C07, D01-O08, P01-P11).`,
        binId 
      });
    }

  const isIncoming = (task.task_type || task.type) === 'incoming' || taskType === 'incoming';
  const isOutgoing = (task.task_type || task.type) === 'outgoing' || taskType === 'outgoing';

    if (isOutgoing) {
      // OUTGOING: Deduct from bin
      let invRes;
      let useNewStructure = false;
      
      // Try new structure first
      try {
        invRes = await client.query(
          `SELECT * FROM "Inventory" WHERE bin_no = $1 AND sku = $2 FOR UPDATE`,
          [binId, task.sku]
        );
        useNewStructure = true;
      } catch (err) {
        // Fallback to old structure
        invRes = await client.query(
          `SELECT * FROM inventory WHERE bin_no = $1 AND sku = $2 FOR UPDATE`,
          [binId, task.sku]
        );
        useNewStructure = false;
      }

      if (invRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Bin with SKU not found', binId, sku: task.sku });
      }

      const currentRow = invRes.rows[0];
      const currentCFC = currentRow.cfc;
      const uom = currentRow.uom;
      const batchNo = currentRow.batch_no;
      const description = currentRow.description;

      if (currentCFC < qtyToProcess) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient quantity in bin', available: currentCFC, requested: qtyToProcess });
      }

      const newCFC = Math.max(0, currentCFC - qtyToProcess);
      const newQTY = newCFC * uom;

      // Update inventory
      if (useNewStructure) {
        await client.query(
          `UPDATE "Inventory" SET cfc = $1, updated_at = CURRENT_TIMESTAMP WHERE bin_no = $2 AND sku = $3`,
          [newCFC, binId, task.sku]
        );
      } else {
        await client.query(
          `UPDATE inventory SET cfc = $1, qty = $2, updated_at = CURRENT_TIMESTAMP WHERE bin_no = $3 AND sku = $4`,
          [newCFC, newQTY, binId, task.sku]
        );
      }

      // Insert into Outgoing table to record the dispatch
      await client.query(
        `INSERT INTO "Outgoing" (sku, batch_no, description, quantity, weight, uom, bin_no, operator_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [task.sku, batchNo, description, qtyToProcess, task.weight || null, uom, binId, sessionValidation.session.operator_id || null]
      );

      // Log transaction
      await client.query(
        `INSERT INTO transactions (transaction_type, bin_id, sku, quantity, operator, previous_value, new_value)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        ['outgoing_scan', binId, task.sku, qtyToProcess, sessionValidation.session.user_name || task.operator || 'unknown', currentCFC, newCFC]
      );

    } else if (isIncoming) {
      // INCOMING: Add to bin
      let currentCFC = 0;
      let newCFC = qtyToProcess;
      let uom = 2.0; // Default UOM
      let description = '';
      let useNewStructure = false;
      
      // Try to get SKU details from Cleaned_FG_Master_file (new structure)
      let expireInDays = null;
      try {
        const skuResult = await client.query(
          `SELECT description, uom, expire_in_days FROM "Cleaned_FG_Master_file" WHERE sku = $1`,
          [task.sku]
        );
        if (skuResult.rows.length > 0) {
          description = skuResult.rows[0].description;
          uom = skuResult.rows[0].uom;
          expireInDays = skuResult.rows[0].expire_in_days;
          useNewStructure = true;
        }
      } catch (err) {
        console.log('Cleaned_FG_Master_file not found, using old structure');
        useNewStructure = false;
      }
      
      if (useNewStructure) {
        // NEW STRUCTURE: Use "Inventory" table with batch-based logic
        // Generate today's batch number
        const todayBatch = generateBatchNumber();
        
        // Check if this bin + today's batch already exists
        const invRes = await client.query(
          `SELECT * FROM "Inventory" WHERE bin_no = $1 AND batch_no = $2 FOR UPDATE`,
          [binId, todayBatch]
        );

        if (invRes.rows.length > 0) {
          // Today's batch exists in this bin - update it
          currentCFC = invRes.rows[0].cfc;
          newCFC = currentCFC + qtyToProcess;

          await client.query(
            `UPDATE "Inventory" 
             SET cfc = $1, updated_at = CURRENT_TIMESTAMP
             WHERE bin_no = $2 AND batch_no = $3`,
            [newCFC, binId, todayBatch]
          );
          
          // Log to Incoming table
          await client.query(
            `INSERT INTO "Incoming" (sku, batch_no, description, quantity, weight, uom, bin_no, operator_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [task.sku, todayBatch, description, qtyToProcess, task.weight || null, uom, binId, sessionValidation.session.operator_id || null]
          );
        } else {
          // Today's batch doesn't exist in this bin - create new row
          newCFC = qtyToProcess;
          
          await client.query(
            `INSERT INTO "Inventory" (bin_no, sku, batch_no, cfc, description, uom, expire_days)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [binId, task.sku, todayBatch, newCFC, description, uom, expireInDays]
          );
          
          // Log to Incoming table
          await client.query(
            `INSERT INTO "Incoming" (sku, batch_no, description, quantity, weight, uom, bin_no, operator_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [task.sku, todayBatch, description, qtyToProcess, task.weight || null, uom, binId, sessionValidation.session.operator_id || null]
          );
        }
      } else {
        // OLD STRUCTURE: Use inventory table
        const invRes = await client.query(
          `SELECT * FROM inventory WHERE bin_no = $1 AND sku = $2 FOR UPDATE`,
          [binId, task.sku]
        );

        if (invRes.rows.length > 0) {
          // Update existing row
          currentCFC = invRes.rows[0].cfc;
          newCFC = currentCFC + qtyToProcess;
          const existingUom = invRes.rows[0].uom || uom;

          await client.query(
            `UPDATE inventory 
             SET cfc = $1, qty = $2, updated_at = CURRENT_TIMESTAMP
             WHERE bin_no = $3 AND sku = $4`,
            [newCFC, newCFC * existingUom, binId, task.sku]
          );
        } else {
          // Insert new row with new batch format: Z05NOV25
          const batchNo = generateBatchNumber();
          
          await client.query(
            `INSERT INTO inventory (bin_no, sku, batch_no, cfc, uom, qty)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [binId, task.sku, batchNo, newCFC, uom, newCFC * uom]
          );
        }
      }

      // Log transaction
      await client.query(
        `INSERT INTO transactions (transaction_type, bin_id, sku, quantity, operator, previous_value, new_value)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        ['incoming_scan', binId, task.sku, qtyToProcess, sessionValidation.session.user_name || task.operator || 'unknown', currentCFC, newCFC]
      );
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid task type', type: task.type });
    }

    // Mark this bin as scanned in the task (add to scanned_bins column)
    try {
      await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scanned_bins TEXT DEFAULT ''`);
    } catch (err) {
      console.warn('Could not add scanned_bins column:', err.message);
    }

    const scannedBins = (task.scanned_bins || '').split(',').filter(Boolean);
    if (!scannedBins.includes(binId)) {
      scannedBins.push(binId);
      await client.query(
        `UPDATE tasks SET scanned_bins = $1 WHERE id = $2`,
        [scannedBins.join(','), parseInt(taskId)]
      );
    }

    await client.query('COMMIT');

    // Calculate progress
    const totalBins = binList.length;
    const scannedCount = scannedBins.length;
    const progress = Math.round((scannedCount / totalBins) * 100);

    // Get updated inventory for response (try new structure first)
    let updatedInv;
    try {
      updatedInv = await client.query(
        `SELECT cfc FROM "Inventory" WHERE bin_no = $1 AND sku = $2`,
        [binId, task.sku]
      );
    } catch (err) {
      updatedInv = await client.query(
        `SELECT cfc FROM inventory WHERE bin_no = $1 AND sku = $2`,
        [binId, task.sku]
      );
    }
    const finalCFC = updatedInv.rows.length > 0 ? updatedInv.rows[0].cfc : 0;

    return res.json({ 
      success: true, 
      binId, 
      sku: task.sku,
      taskType: task.type,
      processed: qtyToProcess, 
      remaining: finalCFC,
      operator: sessionValidation.session.user_name,
      progress: {
        scannedBins: scannedCount,
        totalBins: totalBins,
        percentage: progress
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in /api/bins/scan:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Generate QR code for a specific bin
app.get('/api/bins/qr/:binNo', async (req, res) => {
  try {
    const { binNo } = req.params;
    
    // Check if bin exists
    const result = await db.query(
      'SELECT bin_no FROM "Inventory" WHERE bin_no = $1 LIMIT 1',
      [binNo]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bin not found' });
    }
    
    // Generate QR code as PNG buffer
    const qrBuffer = await QRCode.toBuffer(binNo, {
      type: 'png',
      width: 300,
      margin: 2
    });
    
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `attachment; filename="${binNo}.png"`);
    res.send(qrBuffer);
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download all bin QR codes as ZIP
app.get('/api/bins/qr-all', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT DISTINCT bin_no FROM "Inventory" ORDER BY bin_no'
    );
    
    const bins = result.rows;
    
    // For now, return list of bins for frontend to download individually
    // In future, can add ZIP functionality
    res.json({
      success: true,
      bins: bins.map(row => row.bin_no),
      count: bins.length,
      downloadUrl: '/api/bins/qr/'
    });
  } catch (error) {
    console.error('Error fetching bins:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== REPORTS API ENDPOINTS ====================

// Get report data based on type and date range
app.get('/api/reports', async (req, res) => {
  const client = await db.getClient();
  try {
    const { type, dateRange } = req.query;
    
    // Debug logging
    console.log('=== REPORTS API CALLED ===');
    console.log('Report Type:', type);
    console.log('Date Range:', dateRange);
    console.log('Query params:', req.query);
    
    // Calculate date filter based on range
    let dateFilter = '';
    const now = new Date();
    
    switch(dateRange) {
      case 'today':
        dateFilter = `AND DATE(incoming_date) = CURRENT_DATE`;
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = `AND incoming_date >= '${weekAgo.toISOString()}'`;
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter = `AND incoming_date >= '${monthAgo.toISOString()}'`;
        break;
      default:
        dateFilter = '';
    }
    
    let data = {};
    
    // Fetch data based on report type
    if (type === 'incoming' || type === 'all') {
      try {
        const incomingQuery = `
          SELECT id, sku, batch_no, quantity, bin_no, operator_id, 
                 incoming_date, description, weight
          FROM "Incoming"
          WHERE 1=1 ${dateFilter}
          ORDER BY incoming_date DESC
          LIMIT 100
        `;
        const incomingResult = await client.query(incomingQuery);
        data.incoming = incomingResult.rows;
      } catch (err) {
        console.error('Error fetching incoming data:', err.message);
        data.incoming = [];
      }
    }
    
    if (type === 'outgoing' || type === 'all') {
      try {
        // Build date filter for outgoing table
        let outgoingDateFilter = '';
        if (dateRange) {
          switch(dateRange) {
            case 'today':
              outgoingDateFilter = `AND DATE(outgoing_date) = CURRENT_DATE`;
              break;
            case 'week':
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              outgoingDateFilter = `AND outgoing_date >= '${weekAgo.toISOString()}'`;
              break;
            case 'month':
              const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              outgoingDateFilter = `AND outgoing_date >= '${monthAgo.toISOString()}'`;
              break;
            default:
              outgoingDateFilter = '';
          }
        }
        
        const outgoingQuery = `
          SELECT id, sku, batch_no, quantity, bin_no, operator_id, 
                 outgoing_date, description, weight
          FROM "Outgoing"
          WHERE 1=1 ${outgoingDateFilter}
          ORDER BY outgoing_date DESC
          LIMIT 100
        `;
        console.log('Fetching outgoing data with query:', outgoingQuery);
        const outgoingResult = await client.query(outgoingQuery);
        console.log('Outgoing data fetched:', outgoingResult.rows.length, 'rows');
        data.outgoing = outgoingResult.rows;
      } catch (err) {
        console.error('Error fetching outgoing data:', err.message);
        console.error('Error stack:', err.stack);
        data.outgoing = [];
      }
    }
    
    if (type === 'inventory') {
      try {
        const inventoryQuery = `
          SELECT * FROM "Inventory" WHERE cfc > 0 ORDER BY bin_no, sku LIMIT 200
        `;
        const inventoryResult = await client.query(inventoryQuery);
        console.log('Inventory query successful, rows:', inventoryResult.rows.length);
        data.inventory = inventoryResult.rows;
      } catch (err) {
        console.error('Error fetching inventory data:', err);
        data.inventory = [];
      }
    }
    
    // Final logging before sending response
    console.log('=== REPORTS API RESPONSE ===');
    console.log('Data keys:', Object.keys(data));
    console.log('Incoming count:', data.incoming?.length || 0);
    console.log('Outgoing count:', data.outgoing?.length || 0);
    console.log('Inventory count:', data.inventory?.length || 0);
    
    res.json({ success: true, data });
    
  } catch (error) {
    console.error('Error fetching report data:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Debug endpoint to check inventory data
app.get('/api/debug/inventory', async (req, res) => {
  const client = await db.getClient();
  try {
    const allInventory = await client.query(`
      SELECT bin_no, sku, batch_no, cfc, description, uom, weight, created_at, updated_at
      FROM "Inventory"
      ORDER BY bin_no
      LIMIT 50
    `);
    
    const nonEmptyInventory = await client.query(`
      SELECT bin_no, sku, batch_no, cfc, description, uom, weight
      FROM "Inventory"
      WHERE cfc > 0
      ORDER BY bin_no
    `);
    
    res.json({
      totalRecords: allInventory.rows.length,
      nonEmptyRecords: nonEmptyInventory.rows.length,
      allData: allInventory.rows,
      nonEmptyData: nonEmptyInventory.rows
    });
  } catch (error) {
    console.error('Error fetching inventory debug data:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  } finally {
    client.release();
  }
});

// ==================== AGING COLUMN POPULATION API ====================

app.post('/api/admin/populate-aging', async (req, res) => {
  const client = await db.getClient();
  
  try {
    console.log('🔄 Starting aging column population from Excel...');
    
    const XLSX = require('xlsx');
    const path = require('path');
    
    // Read Excel file
    const excelPath = path.join(__dirname, 'BATCHWISE AGE ANALYSIS REPORT.XLS');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Extract SKU-aging pairs
    const agingMap = new Map();
    let processedRows = 0;
    
    for (let i = 8; i < data.length; i++) {
      const row = data[i];
      const sku = row[3]?.toString().trim(); // Column D
      const aging = parseInt(row[17]); // Column R
      
      if (sku && !isNaN(aging)) {
        if (!agingMap.has(sku)) {
          agingMap.set(sku, []);
        }
        agingMap.get(sku).push(aging);
        processedRows++;
      }
    }
    
    // Calculate average aging
    const skuAgingData = new Map();
    for (const [sku, agingValues] of agingMap) {
      const avgAging = Math.round(agingValues.reduce((a, b) => a + b, 0) / agingValues.length);
      skuAgingData.set(sku, avgAging);
    }
    
    await client.query('BEGIN');
    
    // Add column if not exists
    await client.query(`
      ALTER TABLE "Cleaned_FG_Master_file" 
      ADD COLUMN IF NOT EXISTS aging_days INTEGER DEFAULT NULL
    `);
    
    // Update aging values
    let updatedCount = 0;
    for (const [sku, avgAging] of skuAgingData) {
      const result = await client.query(
        `UPDATE "Cleaned_FG_Master_file" 
         SET aging_days = $1 
         WHERE sku = $2`,
        [avgAging, sku]
      );
      if (result.rowCount > 0) updatedCount++;
    }
    
    await client.query('COMMIT');
    
    // Get stats
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(aging_days) as with_aging,
        AVG(aging_days) as avg_aging
      FROM "Cleaned_FG_Master_file"
    `);
    
    res.json({
      success: true,
      message: 'Aging column populated successfully',
      stats: {
        totalSKUs: parseInt(stats.rows[0].total),
        skusWithAging: parseInt(stats.rows[0].with_aging),
        skusUpdated: updatedCount,
        averageAging: Math.round(stats.rows[0].avg_aging)
      }
    });
    
    console.log(`✅ Aging populated: ${updatedCount} SKUs updated`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Aging population failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack 
    });
  } finally {
    client.release();
  }
});

// ==================== EXPIRE DAYS COLUMN API ====================

app.post('/api/admin/update-expire-days', async (req, res) => {
  const client = await db.getClient();
  
  try {
    console.log('🔄 Replacing aging_days with expire_in_days...');
    
    const XLSX = require('xlsx');
    const path = require('path');
    
    // Read Excel file
    const excelPath = path.join(__dirname, 'BATCHWISE AGE ANALYSIS REPORT.XLS');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Extract SKU and Expiry days
    const skuExpireMap = new Map();
    
    for (let i = 8; i < data.length; i++) {
      const row = data[i];
      const sku = row[3]?.toString().trim(); // Column D
      const mfdDate = row[16]; // Column Q
      const expiryDate = row[18]; // Column S
      
      if (sku && mfdDate && expiryDate) {
        // Parse dates (DD.MM.YYYY format)
        const parseMFD = mfdDate.toString().split('.');
        const parseExpiry = expiryDate.toString().split('.');
        
        if (parseMFD.length === 3 && parseExpiry.length === 3) {
          const mfd = new Date(parseMFD[2], parseMFD[1] - 1, parseMFD[0]);
          const expiry = new Date(parseExpiry[2], parseExpiry[1] - 1, parseExpiry[0]);
          
          const diffDays = Math.ceil((expiry - mfd) / (1000 * 60 * 60 * 24));
          
          if (!skuExpireMap.has(sku)) {
            skuExpireMap.set(sku, []);
          }
          
          skuExpireMap.get(sku).push(diffDays);
        }
      }
    }
    
    // Calculate averages
    
    const finalMap = new Map();
    for (const [sku, days] of skuExpireMap) {
      const avgDays = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
      finalMap.set(sku, avgDays);
    }
    
    await client.query('BEGIN');
    
    // Drop old columns
    await client.query(`
      ALTER TABLE "Cleaned_FG_Master_file" 
      DROP COLUMN IF EXISTS aging_days,
      DROP COLUMN IF EXISTS mfd_date,
      DROP COLUMN IF EXISTS expiry_date
    `);
    
    // Add expire_in_days column
    await client.query(`
      ALTER TABLE "Cleaned_FG_Master_file" 
      ADD COLUMN IF NOT EXISTS expire_in_days INTEGER DEFAULT NULL
    `);
    
    // Update values
    let updatedCount = 0;
    for (const [sku, days] of finalMap) {
      const result = await client.query(
        `UPDATE "Cleaned_FG_Master_file" 
         SET expire_in_days = $1 
         WHERE sku = $2`,
        [days, sku]
      );
      if (result.rowCount > 0) updatedCount++;
    }    await client.query('COMMIT');
    
    // Get stats
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(expire_in_days) as with_expire_days,
        AVG(expire_in_days) as avg_expire_days
      FROM "Cleaned_FG_Master_file"
    `);
    
    res.json({
      success: true,
      message: 'expire_in_days column updated successfully',
      stats: {
        totalSKUs: parseInt(stats.rows[0].total),
        skusWithExpireDays: parseInt(stats.rows[0].with_expire_days),
        skusUpdated: updatedCount,
        averageExpireDays: Math.round(stats.rows[0].avg_expire_days)
      }
    });
    
    console.log(`✅ Expire days updated: ${updatedCount} SKUs`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Expire days update failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack 
    });
  } finally {
    client.release();
  }
});

// ==================== REMOVE BATCH NUMBER COLUMN API ====================

app.post('/api/admin/remove-batch-column', async (req, res) => {
  const client = await db.getClient();
  
  try {
    console.log('🗑️ Removing batch_no column from Cleaned_FG_Master_file...');
    
    await client.query('BEGIN');
    
    // Drop batch_no column
    await client.query(`
      ALTER TABLE "Cleaned_FG_Master_file" 
      DROP COLUMN IF EXISTS batch_no
    `);
    
    await client.query('COMMIT');
    
    // Get updated table info
    const stats = await client.query(`
      SELECT COUNT(*) as total
      FROM "Cleaned_FG_Master_file"
    `);
    
    res.json({
      success: true,
      message: 'batch_no column removed successfully',
      stats: {
        totalSKUs: parseInt(stats.rows[0].total)
      }
    });
    
    console.log('✅ batch_no column removed');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to remove batch_no column:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack 
    });
  } finally {
    client.release();
  }
});

// ==================== BATCH NUMBER COLUMN API ====================

app.post('/api/admin/add-batch-numbers', async (req, res) => {
  const client = await db.getClient();
  
  try {
    console.log('📦 Adding batch_no column...');
    
    const XLSX = require('xlsx');
    const path = require('path');
    
    // Read Excel file
    const excelPath = path.join(__dirname, 'BATCHWISE AGE ANALYSIS REPORT.XLS');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Extract SKU and Batch numbers
    const skuBatchMap = new Map();
    
    for (let i = 8; i < data.length; i++) {
      const row = data[i];
      const sku = row[3]?.toString().trim(); // Column D (index 3)
      const batchNo = row[6]?.toString().trim(); // Column G (index 6) - Batch No.
      
      if (sku && batchNo) {
        if (!skuBatchMap.has(sku)) {
          skuBatchMap.set(sku, []);
        }
        // Avoid duplicates
        if (!skuBatchMap.get(sku).includes(batchNo)) {
          skuBatchMap.get(sku).push(batchNo);
        }
      }
    }
    
    await client.query('BEGIN');
    
    // Add batch_no column
    await client.query(`
      ALTER TABLE "Cleaned_FG_Master_file" 
      ADD COLUMN IF NOT EXISTS batch_no TEXT DEFAULT NULL
    `);
    
    // Update values - store multiple batches as comma-separated
    let updatedCount = 0;
    for (const [sku, batches] of skuBatchMap) {
      const batchString = batches.join(',');
      const result = await client.query(
        `UPDATE "Cleaned_FG_Master_file" 
         SET batch_no = $1 
         WHERE sku = $2`,
        [batchString, sku]
      );
      if (result.rowCount > 0) updatedCount++;
    }
    
    await client.query('COMMIT');
    
    // Get stats
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(batch_no) as with_batch
      FROM "Cleaned_FG_Master_file"
    `);
    
    res.json({
      success: true,
      message: 'batch_no column added successfully',
      stats: {
        totalSKUs: parseInt(stats.rows[0].total),
        skusWithBatch: parseInt(stats.rows[0].with_batch),
        skusUpdated: updatedCount,
        uniqueSKUs: skuBatchMap.size
      }
    });
    
    console.log(`✅ Batch numbers added: ${updatedCount} SKUs`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Batch number update failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack 
    });
  } finally {
    client.release();
  }
});

// ==================== EXPIRE DAYS CALCULATION API ====================

app.post('/api/admin/add-expire-days-column', async (req, res) => {
  const client = await db.getClient();
  
  try {
    console.log('⏰ Adding expire_days column to Inventory...');
    
    await client.query('BEGIN');
    
    // Add expire_days column
    await client.query(`
      ALTER TABLE "Inventory" 
      ADD COLUMN IF NOT EXISTS expire_days INTEGER DEFAULT NULL
    `);
    
    // Get all inventory items with their batch dates
    const inventoryItems = await client.query(`
      SELECT id, sku, batch_no FROM "Inventory"
    `);
    
    let updatedCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to midnight
    
    for (const item of inventoryItems.rows) {
      // Get expire_in_days from master file
      const masterData = await client.query(
        `SELECT expire_in_days FROM "Cleaned_FG_Master_file" WHERE sku = $1`,
        [item.sku]
      );
      
      if (masterData.rows.length > 0 && masterData.rows[0].expire_in_days) {
        const expireInDays = masterData.rows[0].expire_in_days;
        
        // Parse batch date (format: Z07NOV25)
        const batchNo = item.batch_no;
        if (batchNo && batchNo.startsWith('Z')) {
          const dateStr = batchNo.substring(1); // Remove 'Z'
          const day = parseInt(dateStr.substring(0, 2));
          const monthStr = dateStr.substring(2, 5).toUpperCase();
          const year = parseInt('20' + dateStr.substring(5, 7));
          
          const monthMap = {
            'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
            'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
          };
          
          if (monthMap[monthStr] !== undefined) {
            const batchDate = new Date(year, monthMap[monthStr], day);
            batchDate.setHours(0, 0, 0, 0);
            
            // Calculate days passed since batch date
            const daysPassed = Math.floor((today - batchDate) / (1000 * 60 * 60 * 24));
            
            // Calculate remaining expire days
            const expireDays = expireInDays - daysPassed;
            
            // Update inventory
            await client.query(
              `UPDATE "Inventory" SET expire_days = $1 WHERE id = $2`,
              [expireDays, item.id]
            );
            
            updatedCount++;
          }
        }
      }
    }
    
    await client.query('COMMIT');
    
    // Get stats
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(expire_days) as with_expire_days,
        AVG(expire_days) as avg_expire_days
      FROM "Inventory"
    `);
    
    res.json({
      success: true,
      message: 'expire_days column added and calculated successfully',
      stats: {
        totalItems: parseInt(stats.rows[0].total),
        itemsWithExpireDays: parseInt(stats.rows[0].with_expire_days),
        itemsUpdated: updatedCount,
        averageExpireDays: Math.round(stats.rows[0].avg_expire_days) || 0
      }
    });
    
    console.log(`✅ Expire days calculated: ${updatedCount} items`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Expire days calculation failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack 
    });
  } finally {
    client.release();
  }
});

// ==================== CREATE SUPERVISORS TABLE API ====================

app.post('/api/admin/create-supervisors-table', async (req, res) => {
  const client = await db.getClient();
  
  try {
    console.log('👔 Creating Supervisors table...');
    
    await client.query('BEGIN');
    
    // Create Supervisors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Supervisors" (
        supervisor_id VARCHAR(10) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);
    
    // Insert default supervisor
    await client.query(`
      INSERT INTO "Supervisors" (supervisor_id, name, email, password_hash, phone)
      VALUES ('SUP001', 'Supervisor Admin', 'supervisor@itc.com', 'supervisor123', '9876543210')
      ON CONFLICT (email) DO NOTHING
    `);
    
    await client.query('COMMIT');
    
    // Get count
    const stats = await client.query(`SELECT COUNT(*) as total FROM "Supervisors"`);
    
    res.json({
      success: true,
      message: 'Supervisors table created successfully',
      stats: {
        totalSupervisors: parseInt(stats.rows[0].total)
      }
    });
    
    console.log('✅ Supervisors table created with default supervisor');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Supervisors table creation failed:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack 
    });
  } finally {
    client.release();
  }
});

// Add new SKU to Cleaned_FG_Master_file (Supervisor only)
app.post('/api/supervisor/add-sku', async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { sku, description, uom, expireInDays } = req.body;
    
    // Validate required fields
    if (!sku || !description || !uom) {
      return res.status(400).json({
        success: false,
        error: 'SKU, description, and UOM are required fields'
      });
    }
    
    // Check if SKU already exists
    const existingCheck = await client.query(
      `SELECT sku FROM "Cleaned_FG_Master_file" WHERE sku = $1`,
      [sku.toUpperCase()]
    );
    
    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: `SKU '${sku}' already exists in the master list`
      });
    }
    
    await client.query('BEGIN');
    
    // Insert new SKU into master file
    await client.query(
      `INSERT INTO "Cleaned_FG_Master_file" (sku, description, uom, expire_in_days, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [sku.toUpperCase(), description, parseFloat(uom), expireInDays ? parseInt(expireInDays) : null]
    );
    
    // Also add to active_skus table (so it appears in dropdowns immediately)
    await client.query(
      `INSERT INTO active_skus (sku, is_active)
       VALUES ($1, true)
       ON CONFLICT (sku) DO UPDATE SET is_active = true`,
      [sku.toUpperCase()]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ New SKU added: ${sku.toUpperCase()} (active)`);
    
    res.json({
      success: true,
      message: `SKU '${sku.toUpperCase()}' added successfully and is now active in dropdowns`,
      sku: {
        sku: sku.toUpperCase(),
        description,
        uom: parseFloat(uom),
        expire_in_days: expireInDays ? parseInt(expireInDays) : null
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to add SKU:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// ==================== SERVER START ====================

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit - keep server running
});

// Database connection error handling
db.pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  // Pool will auto-reconnect
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n🚀 Server running!`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${LOCAL_IP}:${PORT}`);
  console.log(`\n📱 Use the Network URL to scan QR codes from your phone\n`);
  
  // Test database connection
  try {
    await db.query('SELECT NOW()');
    console.log('✅ PostgreSQL database connected successfully');
    
    // Auto-restructure database if needed
    await autoRestructure();
    
    // Ensure Pending_Tasks table exists (always run this)
    try {
      console.log('📦 Ensuring Pending_Tasks table exists...');
      await db.query(`DROP TABLE IF EXISTS "Pending_Tasks"`);
      await db.query(`
        CREATE TABLE "Pending_Tasks" (
          id SERIAL PRIMARY KEY,
          operator_id VARCHAR(20) NOT NULL,
          task_type VARCHAR(20) NOT NULL CHECK (task_type IN ('incoming', 'outgoing')),
          sku VARCHAR(50) NOT NULL,
          bin_no VARCHAR(20),
          cfc INTEGER,
          weight DECIMAL(10,2),
          batch_no VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired'))
        )
      `);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_pending_tasks_expires ON "Pending_Tasks" (expires_at)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_pending_tasks_operator ON "Pending_Tasks" (operator_id, status)`);
      console.log('✅ Pending_Tasks table ready (with nullable bin_no, cfc, batch_no)');
    } catch (err) {
      console.error('⚠️ Error creating Pending_Tasks table:', err.message);
    }
    
    // Migrate sessions table to fix operator_id column size
    try {
      await migrateSessionsTable();
    } catch (migrationError) {
      console.log('⚠️  Session migration skipped (table may not exist yet)');
    }
    
    // Initialize sessions table
    await sessions.initSessionsTable();
    
    // Clean up expired sessions on startup
    await sessions.cleanupExpiredSessions();
    
    // Schedule periodic cleanup (every hour)
    setInterval(async () => {
      await sessions.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
    
    console.log('✅ Session management initialized\n');
    
    // Schedule daily expire_days update (every 24 hours at midnight)
    const updateExpireDays = async () => {
      try {
        console.log('⏰ Running daily expire_days update...');
        const client = await db.getClient();
        
        try {
          const inventoryItems = await client.query(`
            SELECT id, sku, batch_no FROM "Inventory"
          `);
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          let updatedCount = 0;
          
          for (const item of inventoryItems.rows) {
            const masterData = await client.query(
              `SELECT expire_in_days FROM "Cleaned_FG_Master_file" WHERE sku = $1`,
              [item.sku]
            );
            
            if (masterData.rows.length > 0 && masterData.rows[0].expire_in_days) {
              const expireInDays = masterData.rows[0].expire_in_days;
              const batchNo = item.batch_no;
              
              if (batchNo && batchNo.startsWith('Z')) {
                const dateStr = batchNo.substring(1);
                const day = parseInt(dateStr.substring(0, 2));
                const monthStr = dateStr.substring(2, 5).toUpperCase();
                const year = parseInt('20' + dateStr.substring(5, 7));
                
                const monthMap = {
                  'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
                  'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
                };
                
                if (monthMap[monthStr] !== undefined) {
                  const batchDate = new Date(year, monthMap[monthStr], day);
                  batchDate.setHours(0, 0, 0, 0);
                  
                  const daysPassed = Math.floor((today - batchDate) / (1000 * 60 * 60 * 24));
                  const expireDays = expireInDays - daysPassed;
                  
                  await client.query(
                    `UPDATE "Inventory" SET expire_days = $1 WHERE id = $2`,
                    [expireDays, item.id]
                  );
                  
                  updatedCount++;
                }
              }
            }
          }
          
          console.log(`✅ Daily expire_days update complete: ${updatedCount} items updated`);
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('❌ Daily expire_days update failed:', error.message);
      }
    };
    
    // Run update every 24 hours (86400000 ms)
    setInterval(updateExpireDays, 24 * 60 * 60 * 1000);
    
    // Also run once on startup
    setTimeout(updateExpireDays, 5000); // Wait 5 seconds after startup
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    console.error('   Please check your .env configuration\n');
  }
});
