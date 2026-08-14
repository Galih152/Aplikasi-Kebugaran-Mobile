import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { getDbConfig } from '../config/env.js';

dotenv.config();

let pool = null;

export function getPool() {
  if (!pool) {
    const config = getDbConfig();
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: process.env.VERCEL ? 2 : 10,
      connectTimeout: 15000,
      timezone: '+07:00',
      ssl: { rejectUnauthorized: false },
    });

    pool.on('connection', (connection) => {
      connection.query("SET time_zone = '+07:00'");
    });
  }

  return pool;
}

export default getPool;
