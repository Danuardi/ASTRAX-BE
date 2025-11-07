// wallet.controller.js

const walletService = require('./wallet.service');

async function me(req, res) {
	// req.user set by auth middleware
	const user = req.user;
	if (!user) return res.status(404).json({ error: 'not found' });
	return res.json({ publicKey: user.publicKey, lastLogin: user.lastLogin });
}

// GET /api/wallet/balance
async function getBalance(req, res) {
	try {
		const user = req.user;
		if (!user) return res.status(401).json({ error: 'Unauthorized' });

		const publicKey = user.publicKey;
		const result = await walletService.getBalance(publicKey);
		if (!result) return res.status(500).json({ error: 'failed to fetch balance' });

		return res.json(Object.assign({ publicKey }, result));
	} catch (err) {
		console.error('wallet.getBalance error', err);
		return res.status(500).json({ error: 'internal' });
	}
}

module.exports = { me, getBalance };
