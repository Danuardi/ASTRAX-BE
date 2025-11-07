const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwtSecret } = require('../config/env');

function signJwt(payload, opts = {}) {
	// use publicKey as standard `sub` claim when available
	const signOpts = { expiresIn: opts.expiresIn || '7d' };
	if (payload && payload.publicKey) signOpts.subject = payload.publicKey;
	// generate jwt id (jti) to allow revocation
	const jti = opts.jti || crypto.randomBytes(16).toString('hex');
	signOpts.jwtid = jti;
	// include jti in payload if requested
	const body = Object.assign({}, payload);
	return jwt.sign(body, jwtSecret, signOpts);
}

function verifyJwt(token) {
	return jwt.verify(token, jwtSecret);
}

module.exports = { signJwt, verifyJwt };
