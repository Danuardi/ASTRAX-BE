module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/astra-backend',
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  // default to devnet for development/testing; allow override via SOLANA_NETWORK or RPC_URL
  solanaNetwork: process.env.SOLANA_NETWORK || 'devnet',
  solanaRpcUrl: process.env.SOLANA_RPC_URL || process.env.RPC_URL || '',
  // application identity used in the SIWS message
  appDomain: process.env.APP_DOMAIN || (process.env.HOSTNAME || 'localhost'),
  appUri: process.env.APP_URI || `http://localhost:${process.env.PORT || 3000}`,

  // Nonce TTL (minutes) for SIWS messages
  nonceTtlMinutes: parseInt(process.env.NONCE_TTL_MINUTES || '5', 10),

  // Refresh token lifetime (days)
  refreshTokenDays: parseInt(process.env.REFRESH_TOKEN_DAYS || '30', 10),

  // Access token expiry (jsonwebtoken format)
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRES || '15m'
};

