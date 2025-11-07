const express = require('express');
const controller = require('./auth.controller');
const rateLimiter = require('../../middleware/rateLimiter');

const router = express.Router();

// simple rate limiter for auth endpoints (per-IP)
const authRate = rateLimiter({ windowMs: 60 * 1000, max: 20 });

// Request a nonce to sign
router.post('/nonce', authRate, controller.requestNonce);

// Verify signature and issue JWT + refresh token
router.post('/verify', authRate, controller.verifySignature);

// Refresh access token
router.post('/refresh', authRate, controller.refreshToken);

// Logout / revoke refresh token (and optionally revoke access token)
router.post('/logout', controller.logout);

module.exports = router;
