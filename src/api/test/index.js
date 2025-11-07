const express = require('express');
const controller = require('./test.controller');

const router = express.Router();

router.post('/auth-flow', controller.authFlow);

module.exports = router;
