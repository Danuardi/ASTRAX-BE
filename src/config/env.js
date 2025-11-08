/**
 * Global Environment Configuration
 * ---------------------------------
 * Semua variabel environment aplikasi dikumpulkan di sini.
 * Default values disediakan agar tetap jalan di lokal/dev tanpa .env.
 */

require('dotenv').config();

module.exports = {
  // ────────────────────────────────
  // App Core
  // ────────────────────────────────
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // ────────────────────────────────
  // Database (MongoDB Atlas)
  // ────────────────────────────────
  // Resolve Mongo URI and allow ${VAR} placeholders in .env values
  mongoUri: (() => {
    const raw = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/astra-backend';
    // expand ${VAR} placeholders using other environment variables
    try {
      return String(raw).replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] || '');
    } catch (e) {
      return raw;
    }
  })(),

  mongoDbName:
    process.env.MONGODB_DB_NAME ||
    process.env.MONGO_DB ||
    'astra-backend',

  // ────────────────────────────────
  // Authentication
  // ────────────────────────────────
  jwtSecret: process.env.JWT_SECRET || 'change-me',

  // Token lifetimes
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRES || '15m',
  refreshTokenDays: parseInt(process.env.REFRESH_TOKEN_DAYS || '30', 10),

  // ────────────────────────────────
  // SIWS (Sign-In with Solana)
  // ────────────────────────────────
  solanaNetwork: process.env.SOLANA_NETWORK || 'devnet',
  solanaRpcUrl:
    process.env.SOLANA_RPC_URL ||
    process.env.RPC_URL ||
    '',

  // Nonce TTL (minutes) for SIWS messages
  nonceTtlMinutes: parseInt(process.env.NONCE_TTL_MINUTES || '5', 10),

  // ────────────────────────────────
  // Application Identity
  // ────────────────────────────────
  appDomain: process.env.APP_DOMAIN || process.env.HOSTNAME || 'localhost',
  appUri: process.env.APP_URI || `http://localhost:${process.env.PORT || 3000}`,

  // ────────────────────────────────
  // Upstash / Redis Configuration
  // ────────────────────────────────
  upstashRestUrl:
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_URL ||
    null,

  upstashRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || null,

  upstashRedisUrl:
    process.env.UPSTASH_REDIS_URL ||
    process.env.REDIS_URL ||
    null,
};
