const app = require('./app');
const { connectMongo } = require('./lib/mongo');
const logger = require('./lib/logger');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await connectMongo();
    app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

if (require.main === module) start();

module.exports = app;
