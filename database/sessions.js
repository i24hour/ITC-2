// Session Management Module
const crypto = require('crypto');
const db = require('./db');

// Initialize sessions table
async function initSessionsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        user_identifier VARCHAR(255) NOT NULL,
        user_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )
    `);
    
    // Create index for faster lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_session_token ON user_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_user_identifier ON user_sessions(user_identifier);
      CREATE INDEX IF NOT EXISTS idx_expires_at ON user_sessions(expires_at);
    `);
    
    console.log('✅ Sessions table initialized');
  } catch (error) {
    console.error('Error initializing sessions table:', error);
  }
}

// Generate a secure session token
function generateSecureToken() {
  return 'session_' + crypto.randomBytes(32).toString('hex');
}

// Create a new session
async function createSession(userIdentifier, userName) {
  const sessionToken = generateSecureToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiry
  
  try {
    const result = await db.query(
      `INSERT INTO user_sessions (session_token, user_identifier, user_name, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [sessionToken, userIdentifier, userName, expiresAt]
    );
    
    return {
      success: true,
      sessionToken: result.rows[0].session_token,
      expiresAt: result.rows[0].expires_at
    };
  } catch (error) {
    console.error('Error creating session:', error);
    return { success: false, error: error.message };
  }
}

// Validate a session token
async function validateSession(sessionToken) {
  try {
    const result = await db.query(
      `SELECT * FROM user_sessions 
       WHERE session_token = $1 
       AND is_active = true 
       AND expires_at > NOW()`,
      [sessionToken]
    );
    
    if (result.rows.length === 0) {
      return { valid: false, reason: 'Session not found or expired' };
    }
    
    // Update last accessed time
    await db.query(
      `UPDATE user_sessions SET last_accessed = NOW() WHERE session_token = $1`,
      [sessionToken]
    );
    
    return {
      valid: true,
      session: result.rows[0]
    };
  } catch (error) {
    console.error('Error validating session:', error);
    return { valid: false, reason: error.message };
  }
}

// Invalidate a session (logout)
async function invalidateSession(sessionToken) {
  try {
    await db.query(
      `UPDATE user_sessions SET is_active = false WHERE session_token = $1`,
      [sessionToken]
    );
    return { success: true };
  } catch (error) {
    console.error('Error invalidating session:', error);
    return { success: false, error: error.message };
  }
}

// Clean up expired sessions (run periodically)
async function cleanupExpiredSessions() {
  try {
    const result = await db.query(
      `DELETE FROM user_sessions WHERE expires_at < NOW() OR (is_active = false AND last_accessed < NOW() - INTERVAL '7 days')`
    );
    console.log(`🧹 Cleaned up ${result.rowCount} expired sessions`);
    return result.rowCount;
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    return 0;
  }
}

// Get active sessions for a user
async function getUserSessions(userIdentifier) {
  try {
    const result = await db.query(
      `SELECT session_token, created_at, expires_at, last_accessed 
       FROM user_sessions 
       WHERE user_identifier = $1 AND is_active = true AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userIdentifier]
    );
    
    return {
      success: true,
      sessions: result.rows
    };
  } catch (error) {
    console.error('Error getting user sessions:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  initSessionsTable,
  generateSecureToken,
  createSession,
  validateSession,
  invalidateSession,
  cleanupExpiredSessions,
  getUserSessions
};
