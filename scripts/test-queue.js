// Smoke test for queue helper
require('dotenv').config();
const queue = require('../src/lib/queue');

async function main() {
  const key = 'test:queue:demo';
  console.log('Enqueuing job...');
  const jobId = await queue.enqueue(key, { foo: 'bar', ts: Date.now() });
  console.log('Enqueued jobId', jobId);

  console.log('Attempting to dequeue (will use BRPOP if TCP client present, otherwise LPOP polling)');
  const job = await queue.dequeueOnce(key, 3);
  console.log('Dequeued ->', job);

  console.log('If you want to test the polling worker, call startPollingWorker and enqueue from another process.');
}

main().catch((err) => {
  console.error('TEST-QUEUE ERROR', err);
  process.exit(1);
});
