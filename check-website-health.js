const https = require('https');
const http = require('http');
require('dotenv').config();

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Check if URL is local or remote
function isLocalUrl(url) {
  return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('192.168.');
}

// Make HTTP/HTTPS request
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        }
      });
    });
    
    request.on('error', (error) => {
      reject(error);
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function checkWebsiteHealth() {
  console.log(`\n${colors.bold}${colors.cyan}=== WEBSITE HEALTH CHECK ===${colors.reset}\n`);
  console.log(`${colors.blue}Timestamp: ${new Date().toISOString()}${colors.reset}\n`);

  const baseUrls = [
    'http://localhost:3000',
    'http://localhost:' + (process.env.PORT || 3000),
  ];

  let healthCheckPassed = false;
  let dbStatusPassed = false;
  let baseUrl = null;

  // Try each URL
  for (const url of baseUrls) {
    try {
      console.log(`${colors.yellow}Trying: ${url}${colors.reset}`);
      const response = await makeRequest(`${url}/api/health`);
      if (response.statusCode === 200) {
        baseUrl = url;
        healthCheckPassed = true;
        console.log(`${colors.green}✓ Server is reachable${colors.reset}\n`);
        break;
      }
    } catch (error) {
      console.log(`${colors.red}✗ ${url} not reachable${colors.reset}`);
    }
  }

  if (!baseUrl) {
    console.log(`\n${colors.red}${colors.bold}SERVER IS NOT RUNNING${colors.reset}`);
    console.log(`${colors.yellow}Please start the server with: npm start${colors.reset}\n`);
    process.exit(1);
  }

  // Check Health Endpoint
  console.log(`${colors.bold}1. Health Check Endpoint (/api/health)${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    const health = await makeRequest(`${baseUrl}/api/health`);
    
    if (health.statusCode === 200) {
      console.log(`${colors.green}✓ Status: HEALTHY${colors.reset}`);
      console.log(`  Database: ${health.data.database === 'connected' ? colors.green + '✓ Connected' : colors.red + '✗ Disconnected'}${colors.reset}`);
      console.log(`  Uptime: ${Math.floor(health.data.uptime)} seconds`);
      console.log(`  Environment: ${health.data.environment}`);
    } else {
      console.log(`${colors.red}✗ Status: UNHEALTHY${colors.reset}`);
      console.log(`  Error: ${health.data.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Health check failed: ${error.message}${colors.reset}`);
  }

  // Check Database Status
  console.log(`\n${colors.bold}2. Database Status (/api/db-status)${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    const dbStatus = await makeRequest(`${baseUrl}/api/db-status`);
    
    if (dbStatus.statusCode === 200) {
      dbStatusPassed = true;
      const data = dbStatus.data;
      
      console.log(`${colors.green}✓ Database Connection: ACTIVE${colors.reset}\n`);
      
      // Tables
      console.log(`${colors.bold}Existing Tables:${colors.reset}`);
      if (data.existingTables && data.existingTables.length > 0) {
        data.existingTables.forEach(table => {
          console.log(`  ${colors.green}✓${colors.reset} ${table}`);
        });
      } else {
        console.log(`  ${colors.yellow}No tables found${colors.reset}`);
      }
      
      // Counts
      if (data.counts) {
        console.log(`\n${colors.bold}Record Counts:${colors.reset}`);
        Object.entries(data.counts).forEach(([key, value]) => {
          const label = key.replace(/([A-Z])/g, ' $1').trim();
          console.log(`  ${label}: ${colors.cyan}${value}${colors.reset}`);
        });
      }
      
      // Recent records
      if (data.tables) {
        console.log(`\n${colors.bold}Recent Activity:${colors.reset}`);
        
        if (data.tables.incoming && data.tables.incoming.length > 0) {
          console.log(`  ${colors.green}Latest Incoming (${data.tables.incoming.length}):${colors.reset}`);
          data.tables.incoming.slice(0, 3).forEach(record => {
            console.log(`    ID: ${record.id}, SKU: ${record.sku}, Qty: ${record.quantity}, Bin: ${record.bin_no}`);
          });
        }
        
        if (data.tables.outgoing && data.tables.outgoing.length > 0) {
          console.log(`  ${colors.yellow}Latest Outgoing (${data.tables.outgoing.length}):${colors.reset}`);
          data.tables.outgoing.slice(0, 3).forEach(record => {
            console.log(`    ID: ${record.id}, SKU: ${record.sku}, Qty: ${record.quantity}, Bin: ${record.bin_no}`);
          });
        }
      }
    } else {
      console.log(`${colors.red}✗ Database check failed${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Database status check failed: ${error.message}${colors.reset}`);
  }

  // Database Connection Test (Direct)
  console.log(`\n${colors.bold}3. Direct Database Connection${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    const db = require('./database/db');
    const result = await db.query('SELECT NOW() as current_time, version() as pg_version');
    console.log(`${colors.green}✓ PostgreSQL Connected${colors.reset}`);
    console.log(`  Server Time: ${result.rows[0].current_time}`);
    console.log(`  Version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`);
    console.log(`  Host: ${process.env.DB_HOST}`);
    console.log(`  Database: ${process.env.DB_NAME}`);
  } catch (error) {
    console.log(`${colors.red}✗ Direct database connection failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
  }

  // Summary
  console.log(`\n${colors.bold}${colors.cyan}=== SUMMARY ===${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  const allChecks = healthCheckPassed && dbStatusPassed;
  
  if (allChecks) {
    console.log(`${colors.green}${colors.bold}✓ ALL SYSTEMS OPERATIONAL${colors.reset}`);
    console.log(`${colors.green}  Website URL: ${baseUrl}${colors.reset}`);
    console.log(`${colors.green}  Health Endpoint: ${baseUrl}/api/health${colors.reset}`);
    console.log(`${colors.green}  DB Status: ${baseUrl}/api/db-status${colors.reset}\n`);
  } else {
    console.log(`${colors.red}${colors.bold}✗ SOME ISSUES DETECTED${colors.reset}`);
    if (!healthCheckPassed) console.log(`${colors.red}  - Health check failed${colors.reset}`);
    if (!dbStatusPassed) console.log(`${colors.red}  - Database status check failed${colors.reset}`);
    console.log();
  }

  process.exit(allChecks ? 0 : 1);
}

// Run the health check
checkWebsiteHealth().catch(error => {
  console.error(`\n${colors.red}${colors.bold}FATAL ERROR:${colors.reset}`, error.message);
  process.exit(1);
});
