// ============================================================
//  UCAHRS - Database Connection (Local XAMPP - Hardcoded)
//  No environment variables used – permanent fix for dotenvx interference
// ============================================================

const mysql = require('mysql2');

const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'ucahrs_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

const promisePool = pool.promise();

// Test connection on startup
(async () => {
    try {
        const connection = await promisePool.getConnection();
        console.log('✅ Connected to MariaDB database successfully!');
        connection.release();
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    }
})();

module.exports = promisePool;