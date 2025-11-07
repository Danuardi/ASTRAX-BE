const authService = require('../auth/auth.service');

// POST /api/test/auth-flow { publicKey, signature }
// This endpoint runs: verify -> refresh -> logout to validate the full flow.
async function authFlow(req, res) {
  try {
    const { publicKey, signature } = req.body;
    if (!publicKey || !signature) return res.status(400).json({ error: 'publicKey and signature required' });

    // verify/signin
    const verifyResult = await authService.verifyAndSignin({ publicKey, signature });
    if (!verifyResult) return res.status(401).json({ error: 'verification failed' });

    // refresh access token
    const refreshed = await authService.refreshAccessToken(verifyResult.refreshToken);

    // logout: revoke refresh + access token
    await authService.revokeRefreshToken(verifyResult.refreshToken);
    await authService.revokeAccessToken(verifyResult.token);

    return res.json({ verifyResult, refreshed, logout: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

module.exports = { authFlow };
