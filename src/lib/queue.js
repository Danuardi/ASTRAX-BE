/*
 * Queue helper
 * - enqueue(queueKey, payload) -> jobId
 * - dequeueOnce(queueKey, timeoutSec) -> job or null
 * - startPollingWorker(queueKey, handler, options) -> { stop }
 *
 * Uses ioredis BRPOP when a TCP client is available (more efficient).
 * Falls back to the REST-friendly LPOP polling loop otherwise.
 */

const crypto = require('crypto');
const redis = require('./redis');
const logger = require('../lib/logger');

function makeJobId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

async function enqueue(queueKey, payload) {
  const now = new Date().toISOString();
  const job = {
    id: makeJobId(),
    status: 'pending',
    payload,
    metadata: {
      timestamp: Date.now(),
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      lastError: null
    },
    history: [{
      status: 'pending',
      timestamp: Date.now(),
      details: 'Job created'
    }]
  };

  // rpush exists on the redis helper and accepts strings
  await redis.rpush(queueKey, JSON.stringify(job));
  return job.id;
}

async function dequeueOnce(queueKey, timeoutSec = 5) {
  // Prefer TCP blocking pop if available
  try {
    const ioredis = redis.getIoredis && redis.getIoredis();
    if (ioredis) {
      // BRPOP returns [key, value] or null on timeout
      const res = await ioredis.brpop(queueKey, timeoutSec);
      if (!res) return null;
      const raw = res[1];
      try {
        return JSON.parse(raw);
      } catch (e) {
        logger.warn('queue.dequeueOnce: failed to parse job JSON from TCP client', e);
        return { raw };
      }
    }
  } catch (err) {
    logger.warn('queue.dequeueOnce: ioredis brpop error, falling back to REST lpop', err);
  }

  // REST-friendly LPOP (non-blocking). Consumer should poll.
  const item = await redis.lpop(queueKey);
  return item || null;
}

function startPollingWorker(queueKey, handler, options = {}) {
  // handler: async function(job) -> true if handled, false to re-enqueue or throw
  const {
    intervalMs = 500,
    maxIntervalMs = 5000,
    emptyBackoffFactor = 1.5,
    timeoutSec = 5,
  } = options;

  let currentInterval = intervalMs;
  let stopped = false;

  async function loop() {
    while (!stopped) {
      try {
        const ioredis = redis.getIoredis && redis.getIoredis();
        if (ioredis) {
          // Use blocking pop for efficiency
          const res = await ioredis.brpop(queueKey, 1); // 1 second blocking
          if (!res) {
            // nothing; small sleep
            await new Promise((r) => setTimeout(r, 100));
            continue;
          }
          const raw = res[1];
          let job;
          try { job = JSON.parse(raw); } catch (e) { job = { raw }; }
          try {
            await handler(job);
            currentInterval = intervalMs;
          } catch (err) {
            logger.error('queue worker handler error (TCP)', err);
            // handler failed: you can choose to re-enqueue or record failure
          }
        } else {
          // REST polling path: call lpop
          const job = await redis.lpop(queueKey);
          if (job) {
            try {
              await handler(job);
              currentInterval = intervalMs;
            } catch (err) {
              logger.error('queue worker handler error (REST)', err);
            }
          } else {
            // empty: increase backoff up to max
            currentInterval = Math.min(maxIntervalMs, Math.ceil(currentInterval * emptyBackoffFactor));
            await new Promise((r) => setTimeout(r, currentInterval));
          }
        }
      } catch (err) {
        logger.error('queue worker loop error', err);
        // on unexpected error, wait a bit before retrying
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // start in background
  loop();

  return {
    stop() {
      stopped = true;
    },
  };
}

async function updateJobStatus(queueKey, jobId, status, details = '') {
  const jobKey = `${queueKey}:job:${jobId}`;
  const job = await redis.get(jobKey);
  
  if (!job) return false;

  const now = new Date().toISOString();
  job.status = status;
  job.metadata.updatedAt = now;
  
  // Add to history
  job.history.push({
    status,
    timestamp: Date.now(),
    details
  });

  await redis.set(jobKey, job, 24 * 60 * 60); // 24h TTL
  return true;
}

async function getJobStatus(queueKey, jobId) {
  const jobKey = `${queueKey}:job:${jobId}`;
  return await redis.get(jobKey);
}

module.exports = {
  enqueue,
  dequeueOnce,
  startPollingWorker,
  updateJobStatus,
  getJobStatus
};

