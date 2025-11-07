const { verifyJwt } = require('../lib/jwt');
const User = require('../models/user');
const RevokedToken = require('../models/revokedToken');

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.slice(7);
  try {
    const payload = verifyJwt(token);
    const publicKey = payload.sub || payload.publicKey;
    if (!publicKey) return res.status(401).json({ error: 'Unauthorized' });

    // check token revocation (jti)
    const jti = payload.jti;
    if (jti) {
      const revoked = await RevokedToken.findOne({ jti });
      if (revoked) return res.status(401).json({ error: 'Token revoked' });
    }

    // load user
    const user = await User.findOne({ publicKey });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = authMiddleware;
