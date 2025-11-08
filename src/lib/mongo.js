const mongoose = require('mongoose');
const logger = require('./logger');
const { mongoUri, mongoDbName } = require('../config/env');

async function connectMongo() {
	const uri = mongoUri;
	try {
		await mongoose.connect(uri, { dbName: mongoDbName || undefined });
		logger.info('Connected to MongoDB');
	} catch (err) {
		logger.error('MongoDB connection failed', err);
		throw err;
	}
}

module.exports = { connectMongo };
