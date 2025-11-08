const { Redis } = require('@upstash/redis');
const logger = require('./logger');
const env = require('../config/env');

let restClient = null;
let ioredisClient = null;

// Simple sleep helper for retries
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Create Upstash REST client (if configured)
 */
function createRestClient() {
  if (!env.upstashRestUrl || !env.upstashRestToken) return null;

  try {
    const client = new Redis({
      url: env.upstashRestUrl,
      token: env.upstashRestToken,
      automaticDeserialization: true,
    });

    // test connection asynchronously
    (async () => {
      for (let i = 0; i < 3; i++) {
        try {
          if (typeof client.ping === 'function') {
            await client.ping();
          } else {
            // fallback: simple get of a non-existing key
            await client.get('__upstash_health_check__');
          }
          logger.info('Upstash REST Redis: connected');
          break;
        } catch (err) {
          logger.warn(`Upstash REST Redis ping attempt ${i + 1} failed: ${err.message}`);
          if (i < 2) await sleep(500 * (i + 1));
          else logger.error('Upstash REST Redis ping failed after retries', err);
        }
      }
    })();

    return client;
  } catch (err) {
    logger.error('Failed to create Upstash REST client', err);
    return null;
  }
}

/**
 * Create ioredis TCP client (if configured)
 */
function createIoredisClient() {
  const url = env.upstashRedisUrl;
  if (!url) return null;

  try {
    const IORedis = require('ioredis');
    const client = new IORedis(url, {
      // allow self-signed certs on some managed providers; adjust as needed
      tls: url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
      lazyConnect: false,
    });

    // async connection test
    (async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await client.ping();
          logger.info('ioredis TCP client: connected');
          break;
        } catch (err) {
          logger.warn(`ioredis ping attempt ${i + 1} failed: ${err.message}`);
          if (i < 2) await sleep(500 * (i + 1));
          else logger.error('ioredis ping failed after retries', err);
        }
      }
    })();

    return client;
  } catch (err) {
    logger.error('Failed to create ioredis client', err);
    return null;
  }
}

function getRestClient() {
  if (!restClient) restClient = createRestClient();
  return restClient;
}

function getIoredis() {
  if (!ioredisClient) ioredisClient = createIoredisClient();
  return ioredisClient;
}

/**
 * Normalize value for storage (stringify non-strings)
 */
function serialize(value) {
  if (value === undefined) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (err) {
    logger.warn('Failed to serialize value for redis:', err);
    return String(value);
  }
}

/**
 * Try to parse JSON; otherwise return raw
 */
function tryParse(val) {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch (_) {
    return val;
  }
}

async function set(key, value, ttlSeconds = null) {
  const rest = getRestClient();
  const iored = getIoredis();
  const payload = serialize(value);
  try {
    if (rest) {
      if (ttlSeconds) return await rest.set(key, payload, { ex: ttlSeconds });
      return await rest.set(key, payload);
    }
    if (iored) {
      if (ttlSeconds) return await iored.set(key, payload, 'EX', ttlSeconds);
      return await iored.set(key, payload);
    }
    throw new Error('No Redis client configured');
  } catch (err) {
    logger.error(`Redis SET failed for key ${key}: ${err.message}`);
    throw err;
  }
}

async function get(key) {
  const rest = getRestClient();
  const iored = getIoredis();
  try {
    if (rest) {
      const res = await rest.get(key);
      return tryParse(res);
    }
    if (iored) {
      const res = await iored.get(key);
      return tryParse(res);
    }
    return null;
  } catch (err) {
    logger.error(`Redis GET failed for key ${key}: ${err.message}`);
    throw err;
  }
}

async function del(key) {
  const rest = getRestClient();
  const iored = getIoredis();
  try {
    if (rest) return await rest.del(key);
    if (iored) return await iored.del(key);
    return 0;
  } catch (err) {
    logger.error(`Redis DEL failed for key ${key}: ${err.message}`);
    throw err;
  }
}

async function publish(channel, message) {
  const rest = getRestClient();
  const iored = getIoredis();
  const payload = typeof message === 'string' ? message : serialize(message);
  try {
    if (rest) return await rest.publish(channel, payload);
    if (iored) return await iored.publish(channel, payload);
    throw new Error('No Redis client configured');
  } catch (err) {
    logger.error(`Redis PUBLISH failed for channel ${channel}: ${err.message}`);
    throw err;
  }
}

// List helpers for simple queue patterns (REST supports these commands)
async function rpush(key, ...values) {
  const rest = getRestClient();
  const iored = getIoredis();
  const args = values.map(serialize);
  try {
    if (rest) return await rest.rpush(key, ...args);
    if (iored) return await iored.rpush(key, ...args);
    throw new Error('No Redis client configured');
  } catch (err) {
    logger.error(`Redis RPUSH failed for ${key}: ${err.message}`);
    throw err;
  }
}

async function lpop(key) {
  const rest = getRestClient();
  const iored = getIoredis();
  try {
    if (rest) {
      const res = await rest.lpop(key);
      return tryParse(res);
    }
    if (iored) {
      const res = await iored.lpop(key);
      return tryParse(res);
    }
    return null;
  } catch (err) {
    logger.error(`Redis LPOP failed for ${key}: ${err.message}`);
    throw err;
  }
}

/**
 * Enqueue a JSON-serializable job onto a list and return generated jobId
 */
async function enqueueJob(queueKey, jobPayload) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const job = { id, createdAt: new Date().toISOString(), payload: jobPayload };
  await rpush(queueKey, job);
  return id;
}

async function expire(key, seconds) {
  const rest = getRestClient();
  const iored = getIoredis();
  try {
    if (rest) return await rest.expire(key, seconds);
    if (iored) return await iored.expire(key, seconds);
    throw new Error('No Redis client configured');
  } catch (err) {
    logger.error(`Redis EXPIRE failed for ${key}: ${err.message}`);
    throw err;
  }
}

async function zadd(key, score, member) {
  const rest = getRestClient();
  const iored = getIoredis();
  try {
    if (rest) return await rest.zadd(key, { score, member: serialize(member) });
    if (iored) return await iored.zadd(key, score, serialize(member));
    throw new Error('No Redis client configured');
  } catch (err) {
    logger.error(`Redis ZADD failed for ${key}: ${err.message}`);
    throw err;
  }
}

async function zrange(key, start, stop, withScores = false) {
  const rest = getRestClient();
  const iored = getIoredis();
  try {
    if (rest) {
      const opts = withScores ? { withScores: true } : undefined;
      const res = await rest.zrange(key, start, stop, opts);
      return withScores ? res : res.map(tryParse);
    }
    if (iored) {
      const cmd = withScores ? ['WITHSCORES'] : [];
      const res = await iored.zrange(key, start, stop, ...cmd);
      return withScores ? res : res.map(tryParse);
    }
    return [];
  } catch (err) {
    logger.error(`Redis ZRANGE failed for ${key}: ${err.message}`);
    throw err;
  }
}

async function zremrangebyrank(key, start, stop) {
  const rest = getRestClient();
  const iored = getIoredis();
  try {
    if (rest) return await rest.zremrangebyrank(key, start, stop);
    if (iored) return await iored.zremrangebyrank(key, start, stop);
    throw new Error('No Redis client configured');
  } catch (err) {
    logger.error(`Redis ZREMRANGEBYRANK failed for ${key}: ${err.message}`);
    throw err;
  }
}

async function lrange(key, start, stop) {
  const rest = getRestClient();
  const iored = getIoredis();
  try {
    if (rest) {
      const res = await rest.lrange(key, start, stop);
      return res.map(tryParse);
    }
    if (iored) {
      const res = await iored.lrange(key, start, stop);
      return res.map(tryParse);
    }
    return [];
  } catch (err) {
    logger.error(`Redis LRANGE failed for ${key}: ${err.message}`);
    throw err;
  }
}

async function keys(pattern) {
  const rest = getRestClient();
  const iored = getIoredis();
  try {
    if (rest) return await rest.keys(pattern);
    if (iored) return await iored.keys(pattern);
    return [];
  } catch (err) {
    logger.error(`Redis KEYS failed for ${pattern}: ${err.message}`);
    throw err;
  }
}

module.exports = {
  // clients
  getRestClient,
  getIoredis,
  // KV
  set,
  get,
  del,
  expire,
  // pub/sub & lists
  publish,
  rpush,
  lpop,
  lrange,
  // sorted sets
  zadd,
  zrange,
  zremrangebyrank,
  // keys
  keys,
  // job helper
  enqueueJob,
};
