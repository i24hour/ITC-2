const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const cors = require('cors');
const os = require('os');
const db = require('./database/db');
const sessions = require('./database/sessions');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// ==================== AUTHENTICATION API ENDPOINTS ====================

// Login endpoint - creates server-side session
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // In production, verify password against database
    // For now, accept any login and create session
    
    const sessionResult = await sessions.createSession(email, name || email);
    
    if (!sessionResult.success) {
      return res.status(500).json({ error: 'Failed to create session' });
    }
    
    res.json({
      success: true,
      user: {
        email: email,
        name: name || email,
        loggedIn: true
      },
      sessionToken: sessionResult.sessionToken,
      expiresAt: sessionResult.expiresAt
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: error.message });
  }
});

// Signup endpoint - creates server-side session
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    // In production, hash password and store in database
    // For now, just create session
    
    const sessionResult = await sessions.createSession(email, name);
    
    if (!sessionResult.success) {
      return res.status(500).json({ error: 'Failed to create session' });
    }
    
    res.json({
      success: true,
      user: {
        email: email,
        name: name,
        loggedIn: true
      },
      sessionToken: sessionResult.sessionToken,
      expiresAt: sessionResult.expiresAt
    });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ error: error.message });
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

// Get bins with quantity greater than specified value for a SKU
app.post('/api/search-bins', async (req, res) => {
  try {
    const { sku, value } = req.body;
    const minValue = parseInt(value) || 0;
    
    const result = await db.query(
      `SELECT bin_no, sku, cfc, qty
       FROM "Inventory"
       WHERE sku = $1 AND cfc > $2
       ORDER BY bin_no`,
      [sku, minValue]
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
    console.error('Error searching bins:', error);
    res.status(500).json({ error: error.message });
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
  try {
    // Fetch from Cleaned_FG_Master_file table (new 5-table structure)
    const result = await db.query(
      `SELECT sku FROM "Cleaned_FG_Master_file" ORDER BY sku`
    );
    
    const skus = result.rows.map(row => row.sku);
    res.json({ skus });
  } catch (error) {
    console.error('Error fetching SKU list:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available bins for incoming inventory
app.get('/api/bins/available', async (req, res) => {
  try {
    const { sku } = req.query;
    
    // Get ALL bins with the requested SKU ONLY (no random empty bins)
    // Same logic as /api/bins/fifo - only show bins that have/had this SKU
    const result = await db.query(
      `SELECT bin_no, sku, cfc, qty, batch_no, created_at 
       FROM "Inventory" 
       WHERE sku = $1 
       ORDER BY created_at ASC`,
      [sku]
    );
    
    const partialBins = [];
    const fullBins = [];
    const emptyBins = [];
    const capacity = 50; // Default capacity per bin
    
    result.rows.forEach(row => {
      const currentQty = row.cfc;
      const available = capacity - currentQty;
      
      const binData = {
        id: row.bin_no,
        sku: sku,
        current: currentQty,
        capacity: capacity,
        available: Math.max(0, available),
        batch: row.batch_no
      };
      
      if (currentQty === 0) {
        // Empty bin with same SKU - ready to be filled (e.g., F37 with cfc=0)
        emptyBins.push(binData);
      } else if (currentQty > 0 && currentQty < capacity) {
        // Partially filled - can add more (e.g., L28: 5/50, N34: 24/50)
        partialBins.push(binData);
      } else if (currentQty >= capacity) {
        // Full bin - still show it (e.g., H34: 180/50, P19: 86/50)
        fullBins.push(binData);
      }
    });
    
    // DO NOT add random empty bins like E01, E02 that never had this SKU
    // Only show bins that are in inventory table with this specific SKU
    
    // Return ONLY bins with this SKU (partial + full + empty)
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

// Update bin after incoming
app.post('/api/bins/update', async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { binId, sku, quantity, weight } = req.body;
    
    await client.query('BEGIN');
    
    // Fetch SKU details from Cleaned_FG_Master_file
    const skuResult = await client.query(
      `SELECT description, uom FROM "Cleaned_FG_Master_file" WHERE sku = $1`,
      [sku]
    );
    
    if (skuResult.rows.length === 0) {
      throw new Error(`SKU ${sku} not found in master file`);
    }
    
    const description = skuResult.rows[0].description;
    const uom = skuResult.rows[0].uom;
    
    // Check if row exists in Inventory
    const existingResult = await client.query(
      `SELECT * FROM "Inventory" WHERE bin_no = $1 AND sku = $2`,
      [binId, sku]
    );
    
    let currentCFC = 0;
    let newCFC = parseInt(quantity);
    
    if (existingResult.rows.length > 0) {
      // Update existing row
      currentCFC = existingResult.rows[0].cfc;
      newCFC = currentCFC + parseInt(quantity);
      
      await client.query(
        `UPDATE "Inventory" 
         SET cfc = $1, updated_at = CURRENT_TIMESTAMP
         WHERE bin_no = $2 AND sku = $3`,
        [newCFC, binId, sku]
      );
    } else {
      // Insert new row
      const batchNo = 'NEW' + new Date().toISOString().slice(2, 10).replace(/-/g, '');
      await client.query(
        `INSERT INTO "Inventory" (bin_no, sku, batch_no, cfc, description, uom)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [binId, sku, batchNo, newCFC, description, uom]
      );
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
  try {
    const allResult = await db.query(`SELECT sku FROM active_skus ORDER BY sku`);
    const activeResult = await db.query(`SELECT sku FROM active_skus WHERE is_active = true ORDER BY sku`);
    
    res.json({
      allSKUs: allResult.rows.map(row => row.sku),
      activeSKUs: activeResult.rows.map(row => row.sku)
    });
  } catch (error) {
    console.error('Error fetching active SKUs:', error);
    res.status(500).json({ error: error.message });
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
    } catch (err) {
      console.warn('Could not add session_token column (may already exist):', err.message);
    }

    const result = await db.query(
      `INSERT INTO tasks (operator, sku, bin_no, quantity, task_type, status, session_token)
       VALUES ($1, $2, $3, $4, $5, 'ongoing', $6)
       RETURNING *`,
      [operator, sku, binNo, parseInt(quantity), type, sessionToken || null]
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

  const isIncoming = (task.task_type || task.type) === 'incoming' || taskType === 'incoming';
  const isOutgoing = (task.task_type || task.type) === 'outgoing' || taskType === 'outgoing';

    if (isOutgoing) {
      // OUTGOING: Deduct from bin
      // Find inventory row for this bin and task.sku
      const invRes = await client.query(
        `SELECT * FROM "Inventory" WHERE bin_no = $1 AND sku = $2 FOR UPDATE`,
        [binId, task.sku]
      );

      if (invRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Bin with SKU not found', binId, sku: task.sku });
      }

      const currentRow = invRes.rows[0];
      const currentCFC = currentRow.cfc;
      const uom = currentRow.uom;

      if (currentCFC < qtyToProcess) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient quantity in bin', available: currentCFC, requested: qtyToProcess });
      }

      const newCFC = Math.max(0, currentCFC - qtyToProcess);
      const newQTY = newCFC * uom;

      // UPDATE "Inventory"
      await client.query(
        `UPDATE "Inventory" SET cfc = $1, qty = $2, updated_at = CURRENT_TIMESTAMP WHERE bin_no = $3 AND sku = $4`,
        [newCFC, newQTY, binId, task.sku]
      );

      // Log transaction
      await client.query(
        `INSERT INTO transactions (transaction_type, bin_id, sku, quantity, operator, previous_value, new_value)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        ['outgoing_scan', binId, task.sku, qtyToProcess, sessionValidation.session.user_name || task.operator || 'unknown', currentCFC, newCFC]
      );

    } else if (isIncoming) {
      // INCOMING: Add to bin
      // Check if row exists
      const invRes = await client.query(
        `SELECT * FROM "Inventory" WHERE bin_no = $1 AND sku = $2 FOR UPDATE`,
        [binId, task.sku]
      );

      let currentCFC = 0;
      let newCFC = qtyToProcess;
      const uom = 2.0; // Default UOM

      if (invRes.rows.length > 0) {
        // Update existing row
        const currentRow = invRes.rows[0];
        currentCFC = currentRow.cfc;
        newCFC = currentCFC + qtyToProcess;
        const existingUom = currentRow.uom || uom;

        await client.query(
          `UPDATE "Inventory" 
           SET cfc = $1, qty = $2, updated_at = CURRENT_TIMESTAMP
           WHERE bin_no = $3 AND sku = $4`,
          [newCFC, newCFC * existingUom, binId, task.sku]
        );
      } else {
        // Insert new row
        const batchNo = 'NEW' + new Date().toISOString().slice(2, 10).replace(/-/g, '');
        await client.query(
          `INSERT INTO "Inventory" (bin_no, sku, batch_no, cfc, uom, qty)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [binId, task.sku, batchNo, newCFC, uom, newCFC * uom]
        );
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

    // Get updated inventory for response
    const updatedInv = await client.query(
      `SELECT cfc FROM "Inventory" WHERE bin_no = $1 AND sku = $2`,
      [binId, task.sku]
    );
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
    
    // Initialize sessions table
    await sessions.initSessionsTable();
    
    // Clean up expired sessions on startup
    await sessions.cleanupExpiredSessions();
    
    // Schedule periodic cleanup (every hour)
    setInterval(async () => {
      await sessions.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
    
    console.log('✅ Session management initialized\n');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    console.error('   Please check your .env configuration\n');
  }
});
