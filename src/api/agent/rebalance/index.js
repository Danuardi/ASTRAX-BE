const express = require('express');
const controller = require('./rebalance.controller');
const auth = require('../../../middleware/auth');

const router = express.Router();

// Enqueue a rebalance request. Protected route.
router.post('/', auth, controller.requestRebalance);

// Get metrics summary. Protected route.
router.get('/metrics', auth, controller.getMetrics);

module.exports = router;
