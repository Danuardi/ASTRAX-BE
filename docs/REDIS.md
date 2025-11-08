# Redis Queue & Metrics System

This document describes the Redis-based job queue and metrics system implemented for agent rebalancing operations.

## Environment Setup

Add these environment variables to your `.env` file:

```env
# Redis Configuration
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"  # Upstash REST API URL
UPSTASH_REDIS_REST_TOKEN="your-token"                       # Upstash REST API token
REDIS_URL="rediss://default:password@your-instance:6379"    # Optional TCP connection string
```

The system supports both REST API (via `@upstash/redis`) and TCP (via `ioredis`) connections. The REST client is the primary choice for serverless environments, with TCP as a fallback for better performance when available.

## Queue System

### Queue Architecture

Located in `src/lib/queue.js`, the queue system provides:

1. **Job Enqueuing**: Add jobs to Redis lists with unique IDs and timestamps
2. **Job Dequeuing**: Two dequeuing patterns:
   - Blocking pop (BRPOP) when TCP client is available
   - REST-friendly polling with backoff for serverless environments

### Queue Usage

```javascript
const queue = require('../lib/queue');

// Enqueue a job
const jobId = await queue.enqueue('queue:name', {
  data: 'payload',
  timestamp: Date.now()
});

// Dequeue a single job (uses BRPOP if TCP available)
const job = await queue.dequeueOnce('queue:name', 5); // 5sec timeout

// Start a polling worker (with exponential backoff)
const worker = queue.startPollingWorker('queue:name', 
  async (job) => {
    // handle job
    console.log('Processing:', job);
    return true; // true = handled, false = requeue
  }, {
    intervalMs: 500,      // Initial poll interval
    maxIntervalMs: 5000,  // Max backoff interval
    emptyBackoffFactor: 1.5 // Backoff multiplier
  }
);

// Stop the worker
worker.stop();
```

### Agent Rebalance Integration

The queue system is used in `src/api/agent/rebalance/rebalance.controller.js` to handle rebalance requests:

1. `POST /api/agent/rebalance` enqueues jobs to `agent:rebalance:request`
2. Jobs include:
   - User info (publicKey, id)
   - Request payload
   - Metadata (timestamps, status)
3. Job metadata is stored separately with 24h TTL
4. Returns 202 Accepted with jobId for status tracking

## Metrics & Monitoring

### Metrics System

Located in `src/lib/metrics.js`, provides:

1. **Job Counters**:
   - Daily counters for submitted jobs
   - Keys: `metrics:agent:rebalance:counters:<date>:jobs`
   
2. **Failed Job Tracking**:
   - Stores failure details and payloads
   - Keys: `metrics:agent:rebalance:failed:<jobId>`
   
3. **Execution Time Analytics**:
   - Using sorted sets for percentile analysis
   - Tracks p95 and average execution times
   - Keys: `metrics:agent:rebalance:execution_times`
   
4. **Rate Limiting**:
   - Per-user sliding window rate limits
   - Default: 10 requests per minute
   - Keys: `metrics:agent:rebalance:rate:<userId>`

### Metrics Usage

```javascript
const metrics = require('../lib/metrics');

// Increment job counter
await metrics.incrementCounter('jobs');

// Record failed job
await metrics.recordFailedJob('job-123', new Error('Failed'), {
  context: 'additional info'
});

// Record job timing
const startTime = Date.now() - 1500; // 1.5s ago
await metrics.recordJobTiming('job-123', startTime);

// Check rate limit (10 req/min)
const allowed = await metrics.checkRateLimit('user123', 10, 60);

// Get metrics summary
const summary = await metrics.getMetricsSummary(7); // Last 7 days
// Returns:
{
  totalJobs: 150,
  failedJobs: 3,
  avgExecutionTime: 1200,
  p95ExecutionTime: 2500,
  rateLimit: {
    hits: 1000,
    blocked: 50
  }
}
```

### Metrics REST API

Endpoint: `GET /api/agent/rebalance/metrics`
- Protected route (requires auth)
- Optional query param: `?days=7` for time window
- Returns metrics summary

## Testing

Several test scripts are provided:

1. **Redis Connection Test**:
```bash
node scripts/test-redis.js
```
- Tests both REST + TCP connections
- Verifies set/get/del operations
- Tests queue enqueue/dequeue
- Tests pub/sub functionality

2. **Queue System Test**:
```bash
node scripts/test-queue.js
```
- Tests job enqueuing
- Tests dequeuing (both BRPOP and polling)
- Provides worker example

3. **Metrics System Test**:
```bash
node scripts/test-metrics.js
```
- Tests counter increments
- Tests failed job recording
- Tests timing metrics
- Verifies rate limiting
- Generates metrics summary

## Best Practices

1. **Error Handling**:
   - All Redis operations have proper error handlers
   - Failed jobs are tracked with full context
   - Connection failures trigger automatic retries
   
2. **Data TTL**:
   - Metrics data expires after 7 days
   - Job metadata expires after 24 hours
   - Rate limit data expires with the window
   
3. **Performance**:
   - Uses TCP BRPOP when available for efficiency
   - Implements exponential backoff for polling
   - Rate limiting uses sliding window for accuracy
   
4. **Monitoring**:
   - All operations are logged via the logger utility
   - Failed jobs include stack traces and context
   - Real-time metrics available via API

## Next Steps

Planned improvements:

1. **Status Tracking**:
   - Add `GET /api/agent/rebalance/:jobId` endpoint
   - Real-time status updates via WebSocket
   
2. **Agent Integration**:
   - Example consumer script for agents
   - Automated retries with backoff
   - Dead letter queue for failed jobs
   
3. **Monitoring**:
   - Prometheus metrics export
   - Grafana dashboard templates
   - Alert configurations