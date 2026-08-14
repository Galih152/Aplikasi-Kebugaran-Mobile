import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const aloraPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+07:00',
  ssl: { rejectUnauthorized: false },
});

aloraPool.on('connection', (connection) => {
  connection.query("SET time_zone = '+07:00'");
});

export default aloraPool;
