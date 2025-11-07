// wallet.service.js
const { PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getConnection } = require('../../lib/solana');
const bs58 = require('bs58');

/**
 * Get SOL balance for a given publicKey (devnet by configuration)
 * Returns { lamports, sol }
 */
async function getBalance(publicKey) {
	try {
		if (!publicKey) throw new Error('publicKey required');

		// Validate publicKey
		let pubKeyObj;
		try {
			// allow both bs58 string and PublicKey constructor
			pubKeyObj = new PublicKey(publicKey);
		} catch (e) {
			// try decode bs58 explicitly to provide clearer error
			try {
				bs58.decode(publicKey);
				pubKeyObj = new PublicKey(publicKey);
			} catch (err) {
				throw new Error('invalid publicKey');
			}
		}

		const connection = getConnection();
		const lamports = await connection.getBalance(pubKeyObj);
		const sol = lamports / LAMPORTS_PER_SOL;
		return { lamports, sol };
	} catch (err) {
		// bubble up error to controller which will convert to 4xx/5xx
		throw err;
	}
}

module.exports = { getBalance };
