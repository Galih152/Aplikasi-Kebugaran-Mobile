const DB_KEYS = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];
const AUTH_KEYS = [...DB_KEYS, 'SESSION_SECRET'];

export function getMissingEnvKeys(keys) {
  return keys.filter((key) => !process.env[key]?.trim());
}

export function getRequiredEnv(keys) {
  const missing = getMissingEnvKeys(keys);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}

export function getAuthEnvStatus() {
  const missing = getMissingEnvKeys(AUTH_KEYS);
  return {
    ok: missing.length === 0,
    missing,
  };
}

export function assertAuthEnv() {
  getRequiredEnv(AUTH_KEYS);
}

export function getDbConfig() {
  getRequiredEnv(DB_KEYS);
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  };
}
