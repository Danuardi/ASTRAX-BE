# astra-backend

Microservice scaffold created by assistant. Implements Sign-In With Phantom Wallet (SIWS) -> JWT flow.

Quick start
1. Fill `.env` with at least `MONGO_URI` and `JWT_SECRET`. Optionally set `SOLANA_RPC_URL`, `APP_DOMAIN`, `APP_URI`.
2. New endpoint: GET /api/wallet/balance

Retrieve SOL balance (Devnet by default) for the currently authenticated user.

Usage:

 - Header: Authorization: Bearer <accessToken>
 - GET http://localhost:3000/api/wallet/balance

Response:

 {
	 "publicKey": "...",
	 "lamports": 123456789,
	 "sol": 0.123456789
 }

Notes:
- The route is protected by the auth middleware and requires a valid access token (JWT).
- The service uses the configured Solana RPC (env SOLANA_RPC_URL or default devnet).
2. Install dependencies:
```powershell
cd d:\Astrax-Backend\astra-backend
npm install
```
3. Run in dev mode:
```powershell
npm run dev
```

SIWS (Sign-In With Solana) flow
- POST `/api/auth/nonce` { "publicKey": "<base58 address>" }
	- Server creates a nonce, stores it on the user document, and returns a SIWS-formatted message string to sign.
- Client (Phantom) signs the exact message string with wallet private key and returns a base58 signature.
- POST `/api/auth/verify` { "publicKey": "...", "signature": "<base58 sig>" }
	- Server reconstructs the SIWS message using the nonce stored in DB, verifies the signature, clears the nonce, updates lastLogin, and returns an access JWT and a refresh token.

Additional endpoints
- POST `/api/auth/refresh` { "refreshToken": "..." }  — exchange a valid refresh token for a new access JWT.
- POST `/api/auth/logout` { "refreshToken": "..." } + optional Authorization: Bearer <accessToken> — revoke refresh token and optionally revoke the access token (blacklist jti).

SIWS message structure
The server generates a deterministic message similar to SIWE/SIWS with these fields:

<domain> wants you to sign in with your Solana account:
<address>

<statement>

URI: <uri>
Version: 1
Chain: <chain>
Nonce: <nonce>
Issued At: <issuedAt>

The client must sign this exact string. The server reconstructs the same string during verification.

Client example (Phantom) — sign & exchange
```javascript
// Browser (Phantom) example
async function signInWithPhantom() {
	if (!window.solana || !window.solana.isPhantom) throw new Error('Phantom not installed');

	// connect to phantom
	const resp = await window.solana.connect();
	const publicKey = resp.publicKey.toString();

	// request message from server
	const nonceRes = await fetch('/api/auth/nonce', {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ publicKey })
	});
	const { message } = await nonceRes.json();

	// Phantom expects Uint8Array of the message
	const encoded = new TextEncoder().encode(message);
	const signed = await window.solana.signMessage(encoded, 'utf8');
	// signed.signature is a Uint8Array; convert to base58
	// include bs58 library in client or use @solana/web3.js
	const signatureBase58 = bs58.encode(signed.signature);

	// send signature to server
	const verifyRes = await fetch('/api/auth/verify', {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ publicKey, signature: signatureBase58 })
	});
	const result = await verifyRes.json();
	// result.token contains JWT
}
```

Next steps you can enable
- Rate-limit middleware for the auth endpoints. (implemented simple demo in this repo)
- Token blacklist for logout / immediate revocation. (implemented)
- Refresh token flow (issue refresh tokens, rotate and store securely). (implemented)
- Expand JWT payload with roles/claims and add protected routes.
- Add integration tests and CI.

Test flow endpoint
A convenience endpoint is available to validate the full flow (verify -> refresh -> logout):

POST `/api/test/auth-flow`
Body: { "publicKey": "<base58>", "signature": "<base58 signature>" }

Example using the provided case address
Address: GXHEXYVepv5EQnhq9VYVWkvW6QDMRj4QZA2B2mmKpCzq

1) Request nonce (server returns SIWS message to sign):
```powershell
$body = '{"publicKey":"GXHEXYVepv5EQnhq9VYVWkvW6QDMRj4QZA2B2mmKpCzq"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/nonce -Body $body -ContentType 'application/json'
```
Copy the returned `message` exactly.

2) Use Phantom (in-browser) to sign the message. Convert signed.signature (Uint8Array) to base58 and send it in step 3.

3) Run the full test flow (verify -> refresh -> logout):
```powershell
$body = '{"publicKey":"GXHEXYVepv5EQnhq9VYVWkvW6QDMRj4QZA2B2mmKpCzq", "signature":"<base58 signature from Phantom>"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/test/auth-flow -Body $body -ContentType 'application/json'
```

If everything is correct the response will include the access token, refresh token, refreshed token, and logout result.

If you want, I can add an automated integration test that performs the client signing step using a saved test keypair (not the provided address) so the full flow can be run in CI. Let me know which option you prefer.

