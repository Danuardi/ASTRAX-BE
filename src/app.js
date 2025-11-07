require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const api = require('./api');

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// serve static test files (e.g. public/test.html)
app.use(express.static(path.join(__dirname, '..', 'public')));

// mount API
app.use('/api', api);

// health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = app;
