const crypto = require('crypto');
const bs58 = require('bs58');
const nacl = require('tweetnacl');
const User = require('../../models/user');
const RefreshToken = require('../../models/refreshToken');
const RevokedToken = require('../../models/revokedToken');
const { signJwt, verifyJwt } = require('../../lib/jwt');
const { appDomain, appUri, solanaNetwork, nonceTtlMinutes, refreshTokenDays, accessTokenExpiry } = require('../../config/env');

// Build a SIWS-like structured message. Fields follow the common SIWS pattern
// (domain, address, statement, uri, version, chain, nonce, issuedAt)
function buildSiwsMessage({ domain, address, statement, uri, version = '1', chain = 'solana', nonce, issuedAt }) {
  // Keep the exact format deterministic; clients must sign the exact string
  return `${domain} wants you to sign in with your Solana account:
${address}

${statement}

URI: ${uri}
Version: ${version}
Chain: ${chain}
Nonce: ${nonce}
Issued At: ${issuedAt}`;
}

async function createNonceFor(publicKey) {
  // create a cryptographically strong nonce and persist issuedAt for exact reconstruction
  const nonce = crypto.randomBytes(16).toString('hex');
  const issuedAt = new Date();

  await User.findOneAndUpdate(
    { publicKey },
    { publicKey, nonce, nonceIssuedAt: issuedAt },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const message = buildSiwsMessage({
    domain: appDomain,
    address: publicKey,
    statement: 'Sign this message to authenticate to the application.',
    uri: appUri,
    nonce,
    issuedAt: issuedAt.toISOString(),
  chain: solanaNetwork || 'devnet'
  });

  return message;
}

function isNonceExpired(user) {
  if (!user.nonceIssuedAt) return true;
  const ttl = (nonceTtlMinutes || 5) * 60 * 1000;
  const age = Date.now() - new Date(user.nonceIssuedAt).getTime();
  return age > ttl;
}

async function createRefreshTokenFor(publicKey) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + (refreshTokenDays || 30) * 24 * 60 * 60 * 1000);
  const doc = new RefreshToken({ token, publicKey, expiresAt });
  await doc.save();
  return token;
}

async function verifyAndSignin({ publicKey, signature }) {
  const user = await User.findOne({ publicKey });
  if (!user || !user.nonce || !user.nonceIssuedAt) return null;

  if (isNonceExpired(user)) return null;

  // Reconstruct the exact same message that was signed using stored nonceIssuedAt
  const message = buildSiwsMessage({
    domain: appDomain,
    address: publicKey,
    statement: 'Sign this message to authenticate to the application.',
    uri: appUri,
    nonce: user.nonce,
    issuedAt: user.nonceIssuedAt.toISOString(),
  chain: solanaNetwork || 'devnet'
  });

  const messageBytes = Buffer.from(message);
  let sigBytes, pubKeyBytes;
  try {
    // Try bs58 first (legacy), fall back to base64 if provided by client
    try {
      sigBytes = bs58.decode(signature);
    } catch (e) {
      // assume base64
      sigBytes = Buffer.from(signature, 'base64');
    }
    pubKeyBytes = bs58.decode(publicKey);
  } catch (e) {
    return null;
  }

  const verified = nacl.sign.detached.verify(new Uint8Array(messageBytes), new Uint8Array(sigBytes), new Uint8Array(pubKeyBytes));
  if (!verified) return null;

  // clear nonce and update lastLogin
  user.nonce = null;
  user.nonceIssuedAt = null;
  user.lastLogin = new Date();
  await user.save();

  // issue access token and refresh token
  const accessToken = signJwt({ publicKey }, { expiresIn: accessTokenExpiry });
  const refreshToken = await createRefreshTokenFor(publicKey);

  return { token: accessToken, refreshToken, user: { publicKey, lastLogin: user.lastLogin } };
}

async function refreshAccessToken(refreshToken) {
  const doc = await RefreshToken.findOne({ token: refreshToken });
  if (!doc || doc.revoked) return null;
  if (new Date() > new Date(doc.expiresAt)) return null;

  // issue new access token
  const accessToken = signJwt({ publicKey: doc.publicKey }, { expiresIn: accessTokenExpiry });
  return accessToken;
}

async function revokeRefreshToken(refreshToken) {
  const doc = await RefreshToken.findOne({ token: refreshToken });
  if (!doc) return false;
  doc.revoked = true;
  await doc.save();
  return true;
}

async function revokeAccessToken(accessToken) {
  try {
    const payload = verifyJwt(accessToken);
    const jti = payload.jti || payload.jti; // jwt.verify includes jti
    const exp = payload.exp;
    if (!jti || !exp) return false;
    const expiresAt = new Date(exp * 1000);
    const entry = new RevokedToken({ jti, expiresAt });
    await entry.save();
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { createNonceFor, verifyAndSignin, refreshAccessToken, revokeRefreshToken, revokeAccessToken };

