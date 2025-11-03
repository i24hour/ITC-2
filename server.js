const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const cors = require('cors');
const os = require('os');
const db = require('./database/db');
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

// ==================== INVENTORY API ENDPOINTS ====================

// Get bins with quantity greater than specified value for a SKU
app.post('/api/search-bins', async (req, res) => {
  try {
    const { sku, value } = req.body;
    const minValue = parseInt(value) || 0;
    
    const result = await db.query(
      `SELECT bin_no, sku, cfc, qty
       FROM inventory
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
      `SELECT * FROM inventory WHERE bin_no = $1 AND sku = $2`,
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
    
    // Update inventory
    await client.query(
      `UPDATE inventory 
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
      `SELECT bin_no, sku, cfc, qty FROM inventory ORDER BY bin_no, sku`
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
    const result = await db.query(
      `SELECT sku FROM active_skus WHERE is_active = true ORDER BY sku`
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
    
    // Get bins with the requested SKU
    const result = await db.query(
      `SELECT bin_no, sku, cfc, qty FROM inventory WHERE sku = $1`,
      [sku]
    );
    
    const partialBins = [];
    const capacity = 50; // Default capacity per bin
    
    result.rows.forEach(row => {
      const currentQty = row.cfc;
      if (currentQty > 0 && currentQty < capacity) {
        partialBins.push({
          id: row.bin_no,
          sku: sku,
          current: currentQty,
          capacity: capacity,
          available: capacity - currentQty
        });
      }
    });
    
    // Get all unique bins
    const allBinsResult = await db.query(
      `SELECT DISTINCT bin_no FROM inventory ORDER BY bin_no`
    );
    
    const usedBinsResult = await db.query(
      `SELECT DISTINCT bin_no FROM inventory WHERE cfc > 0`
    );
    
    const allBins = new Set(allBinsResult.rows.map(row => row.bin_no));
    const usedBins = new Set(usedBinsResult.rows.map(row => row.bin_no));
    
    const emptyBins = [];
    allBins.forEach(binNo => {
      if (!usedBins.has(binNo)) {
        emptyBins.push({
          id: binNo,
          sku: null,
          current: 0,
          capacity: 50,
          available: 50
        });
      }
    });
    
    res.json({ partialBins, emptyBins });
  } catch (error) {
    console.error('Error fetching available bins:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get bins in FIFO order for outgoing
app.get('/api/bins/fifo', async (req, res) => {
  try {
    const { sku } = req.query;
    
    const result = await db.query(
      `SELECT bin_no, sku, cfc, batch_no, created_at
       FROM inventory
       WHERE sku = $1
       ORDER BY created_at ASC`,
      [sku]
    );
    
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
    
    // Check if row exists
    const existingResult = await client.query(
      `SELECT * FROM inventory WHERE bin_no = $1 AND sku = $2`,
      [binId, sku]
    );
    
    let currentCFC = 0;
    let newCFC = parseInt(quantity);
    const uom = parseFloat(weight) || 2.0;
    
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
      // Insert new row
      const batchNo = 'NEW' + new Date().toISOString().slice(2, 10).replace(/-/g, '');
      await client.query(
        `INSERT INTO inventory (bin_no, sku, batch_no, cfc, uom, qty)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [binId, sku, batchNo, newCFC, uom, newCFC * uom]
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
      `SELECT * FROM inventory WHERE bin_no = $1 AND sku = $2`,
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
    
    // Update inventory
    await client.query(
      `UPDATE inventory 
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
      `SELECT COALESCE(SUM(cfc), 0) as total FROM inventory`
    );
    
    const activeBinsResult = await db.query(
      `SELECT COUNT(DISTINCT bin_no) as count FROM inventory WHERE cfc > 0`
    );
    
    const emptyBinsResult = await db.query(
      `SELECT COUNT(DISTINCT bin_no) as count FROM inventory WHERE cfc = 0`
    );
    
    const skuTypesResult = await db.query(
      `SELECT COUNT(DISTINCT sku) as count FROM inventory WHERE cfc > 0`
    );
    
    const totalBinsResult = await db.query(
      `SELECT COUNT(DISTINCT bin_no) as count FROM inventory`
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
    
    const formatTask = (row) => ({
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
      reason: row.cancel_reason
    });
    
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
    const { operator, sku, binNo, quantity, type } = req.body;
    
    if (!operator || !sku || !binNo || !quantity || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await db.query(
      `INSERT INTO tasks (operator, sku, bin_no, quantity, task_type, status)
       VALUES ($1, $2, $3, $4, $5, 'ongoing')
       RETURNING *`,
      [operator, sku, binNo, parseInt(quantity), type]
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

// Generate QR code for a specific bin
app.get('/api/bins/qr/:binNo', async (req, res) => {
  try {
    const { binNo } = req.params;
    
    // Check if bin exists
    const result = await db.query(
      'SELECT bin_no FROM inventory WHERE bin_no = $1 LIMIT 1',
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
      'SELECT DISTINCT bin_no FROM inventory ORDER BY bin_no'
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
    console.log('✅ PostgreSQL database connected successfully\n');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    console.error('   Please check your .env configuration\n');
  }
});
