// Print resolved mongoUri (masked) for debugging
const env = require('../src/config/env');
function maskUri(uri) {
  if (!uri) return uri;
  return uri.replace(/:\/\/([^:]+):([^@]+)@/, (m, user, pass) => `://${user}:*****@`);
}
console.log('Resolved mongoUri:', maskUri(env.mongoUri));
console.log('mongoDbName:', env.mongoDbName);
