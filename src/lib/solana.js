const { Connection, clusterApiUrl } = require('@solana/web3.js');
const { solanaNetwork, solanaRpcUrl } = require('../config/env');

let connection;

function getConnection() {
	if (!connection) {
		const network = solanaNetwork || 'devnet';
		const url = solanaRpcUrl || clusterApiUrl(network);
		connection = new Connection(url, 'confirmed');
	}
	return connection;
}

module.exports = { getConnection };
