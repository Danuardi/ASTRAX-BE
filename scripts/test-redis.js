// Load .env so env values (UPSTASH...) are available when modules read config
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const redis = require('../src/lib/redis');

(async () => {
  try {
    console.log('Rest client present:', !!redis.getRestClient());
    console.log('ioredis client present:', !!redis.getIoredis());

    const key = 'test:redis:ping';
    await redis.set(key, { ok: true, ts: Date.now() }, 30);
    const val = await redis.get(key);
    console.log('GET ->', val);
    const del = await redis.del(key);
    console.log('DEL ->', del);

    // enqueue test
    const jobId = await redis.enqueueJob('agent:rebalance:request', { foo: 'bar' });
    console.log('Enqueued jobId', jobId);

    const popped = await redis.lpop('agent:rebalance:request');
    console.log('LPOP ->', popped);

    // publish test
    const pubres = await redis.publish('test:channel', { hello: 'world' });
    console.log('PUBLISH ->', pubres);

    console.log('TEST OK');
    // clean up ioredis connection if present to allow process to exit cleanly
    const iored = redis.getIoredis();
    if (iored && typeof iored.disconnect === 'function') {
      try { iored.disconnect(); } catch (e) { /* ignore */ }
    }
    process.exit(0);
  } catch (e) {
    console.error('Test failed', e);
    process.exit(1);
  }
})();
