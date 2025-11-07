const mongoose = require('mongoose');
const logger = require('./logger');
const { mongoUri } = require('../config/env');

async function connectMongo() {
	const uri = mongoUri;
	await mongoose.connect(uri, { dbName: process.env.MONGO_DB || undefined });
	logger.info('Connected to MongoDB');
}

module.exports = { connectMongo };
