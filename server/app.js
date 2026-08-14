import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './auth/auth.routes.js';
import { getAuthEnvStatus } from './config/env.js';
import getPool from './db/alora.js';

dotenv.config();

function buildAllowedOrigins() {
  const origins = new Set([
    process.env.CORS_ORIGIN,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'http://localhost:8443',
  ]);

  return [...origins].filter(Boolean);
}

export function createApp() {
  const app = express();
  const allowedOrigins = buildAllowedOrigins();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, allowedOrigins[0] ?? true);
      },
      credentials: false,
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    const env = getAuthEnvStatus();
    res.json({
      ok: env.ok,
      missingEnv: env.missing,
      vercel: Boolean(process.env.VERCEL),
    });
  });

  app.get('/api/health/db', async (_req, res) => {
    try {
      const env = getAuthEnvStatus();
      if (!env.ok) {
        return res.status(503).json({ ok: false, missingEnv: env.missing });
      }
      await getPool().query('SELECT 1 AS ok');
      return res.json({ ok: true, db: 'connected' });
    } catch (err) {
      console.error('[health/db]', err.message);
      return res.status(503).json({
        ok: false,
        message: err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT'
          ? 'Database tidak dapat dijangkau dari server Vercel'
          : err.message,
      });
    }
  });

  app.use('/api/auth', authRoutes);

  return app;
}
