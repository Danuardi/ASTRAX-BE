const authService = require('./auth.service');

// POST /api/auth/nonce { publicKey }
async function requestNonce(req, res) {
  try {
    const { publicKey } = req.body;
    if (!publicKey) return res.status(400).json({ error: 'publicKey required' });

    const message = await authService.createNonceFor(publicKey);
    return res.json({ message });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

// POST /api/auth/verify { publicKey, signature }
async function verifySignature(req, res) {
  try {
    const { publicKey, signature } = req.body;
    if (!publicKey || !signature) return res.status(400).json({ error: 'publicKey and signature required' });

    const result = await authService.verifyAndSignin({ publicKey, signature });
    if (!result) return res.status(401).json({ error: 'invalid signature or nonce expired' });

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

// POST /api/auth/refresh { refreshToken }
async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

    const token = await authService.refreshAccessToken(refreshToken);
    if (!token) return res.status(401).json({ error: 'invalid or expired refresh token' });

    return res.json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

// POST /api/auth/logout { refreshToken } with optional Authorization header for access token
async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (refreshToken) await authService.revokeRefreshToken(refreshToken);
    if (accessToken) await authService.revokeAccessToken(accessToken);

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

module.exports = { requestNonce, verifySignature, refreshToken, logout };
