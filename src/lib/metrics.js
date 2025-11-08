const redis = require('./redis');

// Metrics keys
const METRICS_PREFIX = 'metrics:agent:rebalance';
const COUNTERS_KEY = `${METRICS_PREFIX}:counters`;
const FAILED_JOBS_KEY = `${METRICS_PREFIX}:failed`;
const EXECUTION_TIMES_KEY = `${METRICS_PREFIX}:execution_times`;
const RATE_LIMITER_KEY = `${METRICS_PREFIX}:rate`;

// One week TTL for metrics
const METRICS_TTL = 7 * 24 * 60 * 60;

async function incrementCounter(metric) {
  const today = new Date().toISOString().split('T')[0];
  const key = `${COUNTERS_KEY}:${today}:${metric}`;
  await redis.rpush(key, Date.now());
  await redis.expire(key, METRICS_TTL);
}

async function recordFailedJob(jobId, error, payload) {
  const failureInfo = {
    jobId,
    error: error?.message || String(error),
    payload: payload || {},
    timestamp: Date.now(),
  };
  await redis.set(`${FAILED_JOBS_KEY}:${jobId}`, failureInfo, METRICS_TTL);
}

async function recordJobTiming(jobId, startTime) {
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  // Store in sorted set by duration for percentile analysis
  await redis.zadd(EXECUTION_TIMES_KEY, duration, jobId);
  // Trim to last 1000 executions
  await redis.zremrangebyrank(EXECUTION_TIMES_KEY, 0, -1001);
  await redis.expire(EXECUTION_TIMES_KEY, METRICS_TTL);
}

async function checkRateLimit(userId, limit = 10, windowSeconds = 60) {
  const now = Date.now();
  const key = `${RATE_LIMITER_KEY}:${userId}`;
  
  // Add current timestamp to list
  await redis.rpush(key, now);
  await redis.expire(key, windowSeconds);
  
  // Get all timestamps in window
  const times = await redis.lrange(key, 0, -1);
  const windowStart = now - (windowSeconds * 1000);
  
  // Filter to recent requests and trim list
  const recentCount = times.filter(t => parseInt(t) > windowStart).length;
  if (recentCount > limit) {
    return false; // rate limited
  }
  
  // Cleanup old entries
  const validTimes = times.filter(t => parseInt(t) > windowStart);
  if (validTimes.length < times.length) {
    await redis.del(key);
    if (validTimes.length > 0) {
      await redis.rpush(key, ...validTimes);
      await redis.expire(key, windowSeconds);
    }
  }
  
  return true; // not rate limited
}

async function getMetricsSummary(days = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  
  const summary = {
    totalJobs: 0,
    failedJobs: 0,
    avgExecutionTime: 0,
    p95ExecutionTime: 0,
    rateLimit: {
      hits: 0,
      blocked: 0,
    },
  };
  
  // Collect daily counters
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.toISOString().split('T')[0];
    const countsKey = `${COUNTERS_KEY}:${day}:jobs`;
    const counts = await redis.lrange(countsKey, 0, -1);
    summary.totalJobs += counts.length;
  }
  
  // Get failed jobs count
  const failedKeys = await redis.keys(`${FAILED_JOBS_KEY}:*`);
  summary.failedJobs = failedKeys.length;
  
  // Calculate execution time percentiles
  const times = await redis.zrange(EXECUTION_TIMES_KEY, 0, -1, 'WITHSCORES');
  if (times.length > 0) {
    const durations = times.filter((_, i) => i % 2 === 1).map(Number);
    summary.avgExecutionTime = durations.reduce((a,b) => a + b, 0) / durations.length;
    const p95Index = Math.floor(durations.length * 0.95);
    summary.p95ExecutionTime = durations[p95Index] || 0;
  }
  
  return summary;
}

module.exports = {
  incrementCounter,
  recordFailedJob,
  recordJobTiming,
  checkRateLimit,
  getMetricsSummary,
};