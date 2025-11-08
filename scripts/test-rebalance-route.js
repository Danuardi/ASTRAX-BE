// Test script for rebalance controller without starting the server
require('dotenv').config();
const controller = require('../src/api/agent/rebalance/rebalance.controller');
const User = require('../src/models/user');
const redis = require('../src/lib/redis');

async function run() {
  // create a fake user object (do not persist)
  const fakeUser = { _id: 'fakeUser1', publicKey: 'FAKE_PUBKEY' };

  // build rebalance payload requested: "Rebalance 10SOL DEVNET to 90% TOKEN A"
  const rebalancePayload = {
    description: 'Rebalance 10SOL DEVNET to 90% TOKEN A',
    network: 'devnet',
    from: { asset: 'SOL', amount: 10 },
    targets: [ { token: 'TOKEN A', percent: 90 } ],
    mode: 'rebalance',
  };

  // mock req/res
  const req = { user: fakeUser, body: rebalancePayload };
  const res = {
    status(code) {
      this._status = code; return this;
    },
    json(obj) { console.log('RES JSON:', this._status || 200, obj); }
  };

  await controller.requestRebalance(req, res);

  // cleanup: close redis TCP client if present so process can exit cleanly
  try {
    const redisLib = require('../src/lib/redis');
    const ioredis = redisLib.getIoredis && redisLib.getIoredis();
    if (ioredis && typeof ioredis.disconnect === 'function') {
      await ioredis.disconnect();
    }
  } catch (e) {
    // ignore
  }

  // exit explicitly with success
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
