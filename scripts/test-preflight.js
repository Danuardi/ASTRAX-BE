// test-preflight.js
// Check for required environment variables and connectivity
require('dotenv').config();
const logger = require('../src/lib/logger');
const redis = require('../src/lib/redis');

function checkEnvVar(name) {
  const val = process.env[name];
  if (!val) {
    logger.error(`Missing required env var: ${name}`);
    return false;
  }
  return true;
}

async function main() {
  const required = [
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
  ];

  // Check required env vars
  const missing = required.filter(name => !checkEnvVar(name));
  if (missing.length > 0) {
    logger.error('Required env vars missing. Refer to docs/REDIS.md for setup.');
    process.exit(1);
  }

  try {
    // Check Redis REST connection
    logger.info('Testing Redis REST client...');
    const rest = redis.getRestClient();
    if (!rest) throw new Error('Failed to create REST client');
    await rest.ping();
    logger.info('Redis REST client: OK');

    // Check Redis TCP connection if configured
    if (process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL) {
      logger.info('Testing Redis TCP client...');
      const ioredis = redis.getIoredis();
      if (!ioredis) throw new Error('Failed to create TCP client');
      await ioredis.ping();
      logger.info('Redis TCP client: OK');
    }

    logger.info('Preflight checks passed.');
    process.exit(0);
  } catch (err) {
    logger.error('Preflight check failed:', err);
    process.exit(1);
  }
}

main();