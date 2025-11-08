// Test metrics tracking for rebalance jobs
require('dotenv').config();
const metrics = require('../src/lib/metrics');

async function test() {
  console.log('Testing metrics...');

  // simulate some jobs
  await metrics.incrementCounter('jobs');
  await metrics.incrementCounter('jobs');
  
  // simulate a failed job
  await metrics.recordFailedJob('test-job-1', new Error('Test failure'), { reason: 'test' });
  
  // simulate job timing
  const startTime = Date.now() - 1500; // 1.5s ago
  await metrics.recordJobTiming('test-job-2', startTime);
  
  // test rate limiting
  const userId = 'test-user';
  for (let i = 0; i < 12; i++) {
    const limited = await metrics.checkRateLimit(userId, 10, 60);
    console.log(`Request ${i+1}: rate limited? ${!limited}`);
  }
  
  // get summary
  const summary = await metrics.getMetricsSummary(1);
  console.log('\nMetrics Summary:', JSON.stringify(summary, null, 2));
  
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});