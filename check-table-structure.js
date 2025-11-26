// Check Incoming and Outgoing table structure
async function checkTableStructure() {
  try {
    console.log('Checking Incoming table...\n');
    const incomingRes = await fetch('https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net/api/db-status');
    const data = await incomingRes.json();
    
    console.log('Incoming records:', data.tables.incoming);
    console.log('\nOutgoing records:', data.tables.outgoing);
    
    if (data.tables.incoming && data.tables.incoming.length > 0) {
      console.log('\nIncoming columns:', Object.keys(data.tables.incoming[0]));
    }
    
    if (data.tables.outgoing && data.tables.outgoing.length > 0) {
      console.log('Outgoing columns:', Object.keys(data.tables.outgoing[0]));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkTableStructure();
