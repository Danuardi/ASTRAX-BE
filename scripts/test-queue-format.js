// test-queue-format.js
// Test enhanced queue job format
require('dotenv').config();
const queue = require('../src/lib/queue');
const logger = require('../src/lib/logger');

async function main() {
  const queueKey = 'test:queue:enhanced';
  
  // Test job enqueue with enhanced format
  const jobPayload = {
    type: 'test',
    data: { foo: 'bar' },
    priority: 'high'
  };

  logger.info('Enqueuing test job...');
  const jobId = await queue.enqueue(queueKey, jobPayload);
  logger.info('Enqueued job:', jobId);

  // Get job immediately
  const job = await queue.getJobStatus(queueKey, jobId);
  logger.info('Initial job state:', job);

  // Update status
  await queue.updateJobStatus(queueKey, jobId, 'processing', 'Job picked up by worker');
  const updatedJob = await queue.getJobStatus(queueKey, jobId);
  logger.info('Updated job state:', updatedJob);

  // Complete job
  await queue.updateJobStatus(queueKey, jobId, 'completed', 'Job processed successfully');
  const finalJob = await queue.getJobStatus(queueKey, jobId);
  logger.info('Final job state:', finalJob);

  // Validate job format
  const validFormat = finalJob.id 
    && finalJob.status
    && finalJob.metadata?.timestamp
    && finalJob.metadata?.createdAt
    && finalJob.metadata?.updatedAt
    && Array.isArray(finalJob.history);

  if (!validFormat) {
    throw new Error('Job format validation failed');
  }

  logger.info('Queue format test completed successfully');
  process.exit(0);
}

main().catch(err => {
  logger.error('Test failed:', err);
  process.exit(1);
});