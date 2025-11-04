const db = require('./db');
const { restructure } = require('./restructure');

// Auto-run restructure if new tables don't exist
async function autoRestructure() {
  try {
    console.log('🔍 Checking database structure...');
    
    // Check if new table exists
    const checkTable = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'Cleaned_FG_Master_file'
      );
    `);
    
    if (!checkTable.rows[0].exists) {
      console.log('⚠️ New table structure not found. Running auto-restructure...');
      await restructure();
      console.log('✅ Auto-restructure completed successfully!');
    } else {
      console.log('✅ Database structure is up to date.');
    }
  } catch (error) {
    console.error('❌ Auto-restructure check failed:', error.message);
    // Don't throw - let the app continue with fallback logic
  }
}

module.exports = { autoRestructure };
