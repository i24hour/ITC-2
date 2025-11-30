const https = require('https');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m'
};

const AZURE_URL = 'https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net';

// Make HTTPS request
function makeRequest(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const request = https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data.trim() ? JSON.parse(data) : {},
            responseTime
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
            responseTime
          });
        }
      });
    });
    
    request.on('error', (error) => {
      reject(error);
    });
    
    request.setTimeout(timeout, () => {
      request.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  let result = [];
  if (days > 0) result.push(`${days}d`);
  if (hours > 0) result.push(`${hours}h`);
  if (minutes > 0) result.push(`${minutes}m`);
  if (secs > 0 || result.length === 0) result.push(`${secs}s`);
  
  return result.join(' ');
}

async function checkAzureHealth() {
  console.log(`\n${colors.bold}${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}║     AZURE WEBSITE HEALTH CHECK - ITC WAREHOUSE APP         ║${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  console.log(`${colors.blue}🌐 Website URL:${colors.reset} ${AZURE_URL}`);
  console.log(`${colors.blue}📅 Check Time:${colors.reset} ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n`);
  
  const checks = {
    website: false,
    health: false,
    database: false,
    dbStatus: false
  };
  
  let healthData = null;
  let dbStatusData = null;

  // 1. Check if website is reachable
  console.log(`${colors.bold}${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bold}1. Website Accessibility${colors.reset}`);
  console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    const response = await makeRequest(AZURE_URL);
    checks.website = response.statusCode === 200;
    
    if (checks.website) {
      console.log(`${colors.green}✓ Website is reachable${colors.reset}`);
      console.log(`  Status Code: ${colors.green}${response.statusCode} OK${colors.reset}`);
      console.log(`  Response Time: ${colors.cyan}${response.responseTime}ms${colors.reset}`);
      console.log(`  Content Type: ${response.headers['content-type'] || 'N/A'}`);
      console.log(`  Content Length: ${formatBytes(parseInt(response.headers['content-length'] || 0))}`);
    } else {
      console.log(`${colors.red}✗ Website returned error status: ${response.statusCode}${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Website is not reachable${colors.reset}`);
    console.log(`  Error: ${error.message}`);
  }

  // 2. Check Health Endpoint
  console.log(`\n${colors.bold}${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bold}2. Health Check Endpoint (/api/health)${colors.reset}`);
  console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    const health = await makeRequest(`${AZURE_URL}/api/health`);
    healthData = health.data;
    
    if (health.statusCode === 200 && health.data.status === 'healthy') {
      checks.health = true;
      checks.database = health.data.database === 'connected';
      
      console.log(`${colors.green}✓ Health Status: HEALTHY${colors.reset}`);
      console.log(`  Response Time: ${colors.cyan}${health.responseTime}ms${colors.reset}`);
      console.log(`  Database: ${health.data.database === 'connected' ? colors.green + '✓ Connected' : colors.red + '✗ Disconnected'}${colors.reset}`);
      console.log(`  Server Uptime: ${colors.cyan}${formatUptime(health.data.uptime)}${colors.reset}`);
      console.log(`  Environment: ${health.data.environment || 'production'}`);
      console.log(`  Timestamp: ${new Date(health.data.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
    } else {
      console.log(`${colors.red}✗ Health Status: UNHEALTHY${colors.reset}`);
      if (health.data.error) {
        console.log(`  Error: ${health.data.error}`);
      }
      if (health.data.database) {
        console.log(`  Database: ${health.data.database}`);
      }
    }
  } catch (error) {
    console.log(`${colors.red}✗ Health endpoint failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
  }

  // 3. Check Database Status
  console.log(`\n${colors.bold}${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bold}3. Database Status (/api/db-status)${colors.reset}`);
  console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  try {
    const dbStatus = await makeRequest(`${AZURE_URL}/api/db-status`);
    dbStatusData = dbStatus.data;
    
    if (dbStatus.statusCode === 200) {
      checks.dbStatus = true;
      
      console.log(`${colors.green}✓ Database Status: CONNECTED${colors.reset}`);
      console.log(`  Response Time: ${colors.cyan}${dbStatus.responseTime}ms${colors.reset}`);
      
      // Tables
      if (dbStatus.data.existingTables && dbStatus.data.existingTables.length > 0) {
        console.log(`\n  ${colors.bold}${colors.yellow}📊 Database Tables (${dbStatus.data.existingTables.length}):${colors.reset}`);
        dbStatus.data.existingTables.forEach((table, index) => {
          const prefix = index === dbStatus.data.existingTables.length - 1 ? '└─' : '├─';
          console.log(`     ${prefix} ${colors.green}${table}${colors.reset}`);
        });
      }
      
      // Record Counts
      if (dbStatus.data.counts) {
        console.log(`\n  ${colors.bold}${colors.yellow}📈 Record Counts:${colors.reset}`);
        Object.entries(dbStatus.data.counts).forEach(([key, value]) => {
          const label = key.replace(/([A-Z])/g, ' $1').trim();
          const formattedLabel = label.charAt(0).toUpperCase() + label.slice(1);
          console.log(`     • ${formattedLabel}: ${colors.cyan}${value.toLocaleString()}${colors.reset}`);
        });
      }
      
      // Recent Activity
      if (dbStatus.data.tables) {
        console.log(`\n  ${colors.bold}${colors.yellow}⚡ Recent Activity:${colors.reset}`);
        
        if (dbStatus.data.tables.incoming && dbStatus.data.tables.incoming.length > 0) {
          console.log(`     ${colors.green}Incoming (Latest ${dbStatus.data.tables.incoming.length}):${colors.reset}`);
          dbStatus.data.tables.incoming.slice(0, 3).forEach(record => {
            console.log(`       → ID: ${record.id}, SKU: ${record.sku}, Qty: ${record.quantity}, Bin: ${record.bin_no || 'N/A'}`);
          });
        }
        
        if (dbStatus.data.tables.outgoing && dbStatus.data.tables.outgoing.length > 0) {
          console.log(`     ${colors.yellow}Outgoing (Latest ${dbStatus.data.tables.outgoing.length}):${colors.reset}`);
          dbStatus.data.tables.outgoing.slice(0, 3).forEach(record => {
            console.log(`       → ID: ${record.id}, SKU: ${record.sku}, Qty: ${record.quantity}, Bin: ${record.bin_no || 'N/A'}`);
          });
        }
        
        if (dbStatus.data.tables.operators && dbStatus.data.tables.operators.length > 0) {
          console.log(`     ${colors.blue}Active Operators (${dbStatus.data.tables.operators.length}):${colors.reset}`);
          dbStatus.data.tables.operators.slice(0, 3).forEach(op => {
            console.log(`       → ID: ${op.operator_id}, Name: ${op.name || 'N/A'}`);
          });
        }
      }
    } else {
      console.log(`${colors.red}✗ Database status check failed${colors.reset}`);
      console.log(`  Status Code: ${dbStatus.statusCode}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Database status endpoint failed${colors.reset}`);
    console.log(`  Error: ${error.message}`);
  }

  // 4. Quick API Tests
  console.log(`\n${colors.bold}${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bold}4. API Endpoint Tests${colors.reset}`);
  console.log(`${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  const endpoints = [
    { path: '/api/skus', name: 'SKUs List' },
    { path: '/api/operators', name: 'Operators' },
    { path: '/api/bins', name: 'Bins' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${AZURE_URL}${endpoint.path}`);
      const status = response.statusCode === 200 ? colors.green + '✓' : colors.red + '✗';
      console.log(`  ${status} ${endpoint.name}: ${response.statusCode} (${response.responseTime}ms)${colors.reset}`);
    } catch (error) {
      console.log(`  ${colors.red}✗ ${endpoint.name}: ${error.message}${colors.reset}`);
    }
  }

  // Summary
  console.log(`\n${colors.bold}${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}║                     HEALTH SUMMARY                         ║${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  const totalChecks = Object.keys(checks).length;
  const passedChecks = Object.values(checks).filter(v => v).length;
  const healthScore = Math.round((passedChecks / totalChecks) * 100);
  
  console.log(`  ${colors.bold}Website Accessible:${colors.reset} ${checks.website ? colors.green + '✓ YES' : colors.red + '✗ NO'}${colors.reset}`);
  console.log(`  ${colors.bold}Health Endpoint:${colors.reset}    ${checks.health ? colors.green + '✓ HEALTHY' : colors.red + '✗ UNHEALTHY'}${colors.reset}`);
  console.log(`  ${colors.bold}Database Connected:${colors.reset} ${checks.database ? colors.green + '✓ YES' : colors.red + '✗ NO'}${colors.reset}`);
  console.log(`  ${colors.bold}DB Status Check:${colors.reset}    ${checks.dbStatus ? colors.green + '✓ PASSED' : colors.red + '✗ FAILED'}${colors.reset}`);
  
  console.log(`\n  ${colors.bold}Health Score:${colors.reset} ${healthScore >= 75 ? colors.green : healthScore >= 50 ? colors.yellow : colors.red}${healthScore}%${colors.reset} (${passedChecks}/${totalChecks} checks passed)`);
  
  if (healthScore === 100) {
    console.log(`\n  ${colors.green}${colors.bold}🎉 ALL SYSTEMS OPERATIONAL!${colors.reset}`);
    console.log(`  ${colors.green}Your Azure website is running perfectly.${colors.reset}`);
  } else if (healthScore >= 75) {
    console.log(`\n  ${colors.yellow}${colors.bold}⚠️  MOSTLY OPERATIONAL${colors.reset}`);
    console.log(`  ${colors.yellow}Some minor issues detected, but core functionality is working.${colors.reset}`);
  } else {
    console.log(`\n  ${colors.red}${colors.bold}❌ CRITICAL ISSUES DETECTED${colors.reset}`);
    console.log(`  ${colors.red}Your website needs immediate attention!${colors.reset}`);
  }
  
  // Quick Access Links
  console.log(`\n${colors.bold}${colors.cyan}Quick Access Links:${colors.reset}`);
  console.log(`  🌐 Website:    ${colors.blue}${AZURE_URL}${colors.reset}`);
  console.log(`  💚 Health:     ${colors.blue}${AZURE_URL}/api/health${colors.reset}`);
  console.log(`  📊 DB Status:  ${colors.blue}${AZURE_URL}/api/db-status${colors.reset}`);
  console.log(`  🔧 Azure Portal: ${colors.blue}https://portal.azure.com${colors.reset}\n`);
  
  process.exit(healthScore === 100 ? 0 : 1);
}

// Run the health check
console.log(`${colors.cyan}Starting Azure health check...${colors.reset}`);
checkAzureHealth().catch(error => {
  console.error(`\n${colors.red}${colors.bold}FATAL ERROR:${colors.reset}`, error.message);
  console.error(error.stack);
  process.exit(1);
});
