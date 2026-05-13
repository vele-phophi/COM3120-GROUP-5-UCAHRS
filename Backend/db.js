const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    ssl: {
        rejectUnauthorized: false   
    }
});

const promisePool = pool.promise();

// Test connection
(async () => {
    try {
        const connection = await promisePool.getConnection();
        console.log('✅ Connected to MySQL database successfully!');
        connection.release();
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    }
})();

module.exports = promisePool;