const express = require('express');
const auth = require('../../middleware/auth');
const controller = require('./wallet.controller');

const router = express.Router();

// Protected route: get current user wallet info
router.get('/me', auth, controller.me);
// GET /api/wallet/balance - returns SOL balance for authenticated user
router.get('/balance', auth, controller.getBalance);

module.exports = router;
