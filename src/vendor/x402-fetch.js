// Vendored x402 payment primitives — self-contained, zero production dependencies.
//
// This file inlines the minimal slice of an x402 client needed by the extension:
// parse a `402 Payment Required` challenge, select a payable requirement, derive
// an EVM address from a private key, sign an EIP-3009 USDC authorization, and
// wrap `fetch` so paid endpoints settle transparently.
//
// The secp256k1 / keccak256 / EIP-712 stack is pure JavaScript and depends only
// on Web Crypto (`crypto.subtle`), which is present in Node >= 18 and every
// modern browser. Nothing here is imported from a sibling or unpublished package,
// so the extension builds from its own files alone.
//
// Public API (used by src/*.js):
//   parseChallenge(response)           -> { accepts, resource, raw } | null
//   selectRequirement(accepts, opts)   -> accept | null
//   amountToUsd(accept)                -> number (USD)
//   privateKeyToWallet(pk)             -> { address, signTypedData(td) }
//   withX402(wallet, options?)         -> fetch-compatible paid fetch
//
// Author: nirholas. License: Apache-2.0.

/* ────────────────────────────── keccak-256 ────────────────────────────── */
// Keccak-256 (the hash Ethereum uses — NOT FIPS-202 SHA3, which differs only in
// the domain-separation pad byte). Verified against keccak256("") =
// c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470.

const MASK64 = (1n << 64n) - 1n;

const RC = [
	0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
	0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
	0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
	0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
	0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
	0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

const ROT = [
	0n, 1n, 62n, 28n, 27n,
	36n, 44n, 6n, 55n, 20n,
	3n, 10n, 43n, 25n, 39n,
	41n, 45n, 15n, 21n, 8n,
	18n, 2n, 61n, 56n, 14n,
];

function rotl(x, n) {
	if (n === 0n) return x & MASK64;
	return ((x << n) | (x >> (64n - n))) & MASK64;
}

function keccakF(state) {
	for (let round = 0; round < 24; round++) {
		// θ
		const C = new Array(5);
		for (let x = 0; x < 5; x++) {
			C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
		}
		const D = new Array(5);
		for (let x = 0; x < 5; x++) {
			D[x] = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1n);
		}
		for (let x = 0; x < 5; x++) {
			for (let y = 0; y < 5; y++) state[x + 5 * y] = state[x + 5 * y] ^ D[x];
		}
		// ρ and π
		const B = new Array(25);
		for (let x = 0; x < 5; x++) {
			for (let y = 0; y < 5; y++) {
				const idx = x + 5 * y;
				const newX = y;
				const newY = (2 * x + 3 * y) % 5;
				B[newX + 5 * newY] = rotl(state[idx], ROT[idx]);
			}
		}
		// χ
		for (let x = 0; x < 5; x++) {
			for (let y = 0; y < 5; y++) {
				state[x + 5 * y] =
					B[x + 5 * y] ^ (~B[((x + 1) % 5) + 5 * y] & B[((x + 2) % 5) + 5 * y]);
				state[x + 5 * y] &= MASK64;
			}
		}
		// ι
		state[0] ^= RC[round];
	}
}

/** Keccak-256 digest. @param {Uint8Array} input @returns {Uint8Array} 32 bytes */
function keccak256(input) {
	const rate = 136; // 1088-bit rate for the 256-bit capacity variant
	const state = new Array(25).fill(0n);

	// Pad: append 0x01, zero-fill, set high bit of the final rate byte (pad10*1).
	const padded = new Uint8Array(Math.ceil((input.length + 1) / rate) * rate);
	padded.set(input);
	padded[input.length] = 0x01;
	padded[padded.length - 1] |= 0x80;

	// Absorb
	for (let offset = 0; offset < padded.length; offset += rate) {
		for (let i = 0; i < rate / 8; i++) {
			let lane = 0n;
			for (let b = 0; b < 8; b++) {
				lane |= BigInt(padded[offset + i * 8 + b]) << BigInt(8 * b);
			}
			state[i] ^= lane;
		}
		keccakF(state);
	}

	// Squeeze (single block — 32 bytes ≤ rate)
	const out = new Uint8Array(32);
	for (let i = 0; i < 4; i++) {
		let lane = state[i];
		for (let b = 0; b < 8; b++) {
			out[i * 8 + b] = Number(lane & 0xffn);
			lane >>= 8n;
		}
	}
	return out;
}

/* ───────────────────────────── secp256k1 ECDSA ─────────────────────────── */
// Just enough of the curve to derive an Ethereum address from a private key and
// produce a 65-byte (r‖s‖v) recoverable signature with RFC-6979 deterministic
// nonces and low-s normalisation — byte-for-byte what MetaMask's
// eth_signTypedData_v4 and viem's signTypedData emit.

const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const Gx = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const Gy = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

function mod(a, m) {
	const r = a % m;
	return r >= 0n ? r : r + m;
}

function invMod(a, m) {
	a = mod(a, m);
	let [old_r, r] = [a, m];
	let [old_s, s] = [1n, 0n];
	while (r !== 0n) {
		const q = old_r / r;
		[old_r, r] = [r, old_r - q * r];
		[old_s, s] = [s, old_s - q * s];
	}
	if (old_r !== 1n) throw new Error('x402: not invertible');
	return mod(old_s, m);
}

function pointAdd(p, q) {
	if (p === null) return q;
	if (q === null) return p;
	const [x1, y1] = p;
	const [x2, y2] = q;
	if (x1 === x2 && mod(y1 + y2, P) === 0n) return null;
	let m;
	if (x1 === x2 && y1 === y2) {
		m = mod(3n * x1 * x1 * invMod(2n * y1, P), P);
	} else {
		m = mod((y2 - y1) * invMod(x2 - x1, P), P);
	}
	const x3 = mod(m * m - x1 - x2, P);
	const y3 = mod(m * (x1 - x3) - y1, P);
	return [x3, y3];
}

function scalarMul(k, point) {
	let result = null;
	let addend = point;
	while (k > 0n) {
		if (k & 1n) result = pointAdd(result, addend);
		addend = pointAdd(addend, addend);
		k >>= 1n;
	}
	return result;
}

function bytesToBig(bytes) {
	let n = 0n;
	for (const b of bytes) n = (n << 8n) | BigInt(b);
	return n;
}

function bigToBytes(n, length) {
	const out = new Uint8Array(length);
	for (let i = length - 1; i >= 0; i--) {
		out[i] = Number(n & 0xffn);
		n >>= 8n;
	}
	return out;
}

function hexToBytes(hex) {
	let h = hex.startsWith('0x') ? hex.slice(2) : hex;
	if (h.length % 2) h = '0' + h;
	const out = new Uint8Array(h.length / 2);
	for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
	return out;
}

function bytesToHex(bytes) {
	let s = '0x';
	for (const b of bytes) s += b.toString(16).padStart(2, '0');
	return s;
}

function getSubtle() {
	const c = globalThis.crypto;
	if (!c || !c.subtle) {
		throw new Error('x402: Web Crypto (crypto.subtle) is required for private-key signing');
	}
	return c.subtle;
}

async function hmacSha256(key, msg) {
	const subtle = getSubtle();
	const k = await subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	return new Uint8Array(await subtle.sign('HMAC', k, msg));
}

function concatBytes(...arrays) {
	const total = arrays.reduce((n, a) => n + a.length, 0);
	const out = new Uint8Array(total);
	let off = 0;
	for (const a of arrays) {
		out.set(a, off);
		off += a.length;
	}
	return out;
}

// RFC-6979 §3.2 — deterministic k generation using HMAC-SHA256.
async function rfc6979(privKey, msgHash) {
	const x = bigToBytes(privKey, 32);
	const h1 = msgHash; // already a 32-byte hash, qlen == hlen == 256
	let v = new Uint8Array(32).fill(1);
	let k = new Uint8Array(32).fill(0);
	k = await hmacSha256(k, concatBytes(v, new Uint8Array([0]), x, h1));
	v = await hmacSha256(k, v);
	k = await hmacSha256(k, concatBytes(v, new Uint8Array([1]), x, h1));
	v = await hmacSha256(k, v);
	for (;;) {
		v = await hmacSha256(k, v);
		const candidate = bytesToBig(v);
		if (candidate >= 1n && candidate < N) return candidate;
		k = await hmacSha256(k, concatBytes(v, new Uint8Array([0])));
		v = await hmacSha256(k, v);
	}
}

/**
 * Sign a 32-byte digest, returning a 65-byte recoverable signature (r‖s‖v) where
 * v ∈ {27, 28} — the Ethereum convention.
 */
async function signDigest(digest, privKey) {
	const z = bytesToBig(digest);
	for (;;) {
		const k = await rfc6979(privKey, digest);
		const R = scalarMul(k, [Gx, Gy]);
		const r = mod(R[0], N);
		if (r === 0n) continue;
		let s = mod(invMod(k, N) * (z + r * privKey), N);
		if (s === 0n) continue;
		let recovery = (R[1] & 1n ? 1 : 0) | (R[0] >= N ? 2 : 0);
		if (s > N / 2n) {
			s = N - s;
			recovery ^= 1;
		}
		const sig = concatBytes(bigToBytes(r, 32), bigToBytes(s, 32), new Uint8Array([27 + recovery]));
		return bytesToHex(sig);
	}
}

function privateKeyToPublicKey(privKey) {
	const Q = scalarMul(privKey, [Gx, Gy]);
	if (!Q) throw new Error('x402: invalid private key');
	return concatBytes(bigToBytes(Q[0], 32), bigToBytes(Q[1], 32));
}

function privateKeyToAddress(privKey) {
	const pub = privateKeyToPublicKey(privKey);
	const hash = keccak256(pub);
	return bytesToHex(hash.slice(12));
}

function normalizePrivateKey(pk) {
	const bytes = typeof pk === 'string' ? hexToBytes(pk) : pk;
	if (bytes.length !== 32) throw new Error('x402: private key must be 32 bytes');
	const n = bytesToBig(bytes);
	if (n <= 0n || n >= N) throw new Error('x402: private key out of range');
	return n;
}

// EIP-55 checksum casing for display addresses.
function toChecksumAddress(address) {
	const addr = address.toLowerCase().replace(/^0x/, '');
	const hash = keccak256(new TextEncoder().encode(addr));
	let out = '0x';
	for (let i = 0; i < addr.length; i++) {
		const nibble = hash[i >> 1] >> (i % 2 === 0 ? 4 : 0);
		out += (nibble & 0x8) !== 0 ? addr[i].toUpperCase() : addr[i];
	}
	return out;
}

/* ──────────────────────────── EIP-712 hashing ──────────────────────────── */
// Produces the 32-byte digest signed for an `eth_signTypedData_v4` request:
// keccak256(0x1901 ‖ domainSeparator ‖ hashStruct(message)). Implements the flat
// struct types the EIP-3009 TransferWithAuthorization payload uses.

function toBigInt(v) {
	if (typeof v === 'bigint') return v;
	if (typeof v === 'number') return BigInt(v);
	if (typeof v === 'string') return v.startsWith('0x') ? BigInt(v) : BigInt(v);
	throw new Error(`x402: cannot coerce ${typeof v} to integer`);
}

function pad32(bytes) {
	if (bytes.length > 32) throw new Error('x402: value exceeds 32 bytes');
	const out = new Uint8Array(32);
	out.set(bytes, 32 - bytes.length);
	return out;
}

function uintToBytes(v) {
	let n = toBigInt(v);
	const out = new Uint8Array(32);
	for (let i = 31; i >= 0; i--) {
		out[i] = Number(n & 0xffn);
		n >>= 8n;
	}
	return out;
}

function encodeValue(type, value) {
	if (type === 'string') {
		return keccak256(new TextEncoder().encode(String(value)));
	}
	if (type === 'bytes') {
		return keccak256(hexToBytes(value));
	}
	if (type === 'bool') {
		return uintToBytes(value ? 1 : 0);
	}
	if (type === 'address') {
		return pad32(hexToBytes(String(value).toLowerCase()));
	}
	if (type.startsWith('uint') || type.startsWith('int')) {
		return uintToBytes(value);
	}
	if (type.startsWith('bytes')) {
		const bytes = hexToBytes(value);
		const out = new Uint8Array(32);
		out.set(bytes.slice(0, 32), 0);
		return out;
	}
	throw new Error(`x402: unsupported EIP-712 type "${type}"`);
}

function encodeType(primaryType, types) {
	const fields = types[primaryType];
	const args = fields.map((f) => `${f.type} ${f.name}`).join(',');
	return `${primaryType}(${args})`;
}

function typeHash(primaryType, types) {
	return keccak256(new TextEncoder().encode(encodeType(primaryType, types)));
}

function hashStruct(primaryType, data, types) {
	const parts = [typeHash(primaryType, types)];
	for (const field of types[primaryType]) {
		parts.push(encodeValue(field.type, data[field.name]));
	}
	const encoded = new Uint8Array(parts.length * 32);
	parts.forEach((p, i) => encoded.set(p, i * 32));
	return keccak256(encoded);
}

function eip712Digest({ domain, types, primaryType, message }) {
	const domainSeparator = hashStruct('EIP712Domain', domain, types);
	const structHash = hashStruct(primaryType, message, types);
	const prefixed = new Uint8Array(2 + 32 + 32);
	prefixed[0] = 0x19;
	prefixed[1] = 0x01;
	prefixed.set(domainSeparator, 2);
	prefixed.set(structHash, 34);
	return keccak256(prefixed);
}

/* ───────────────────────── challenge parsing/selection ─────────────────── */

// Base USDC — the asset/network this wrapper signs for locally (EIP-3009).
export const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
export const NETWORK_BASE = 'eip155:8453';

function b64decodeJson(str) {
	if (!str) return null;
	try {
		const json =
			typeof Buffer !== 'undefined'
				? Buffer.from(str, 'base64').toString('utf8')
				: decodeURIComponent(escape(atob(str)));
		return JSON.parse(json);
	} catch {
		return null;
	}
}

function isEvmNetwork(net) {
	return typeof net === 'string' && net.startsWith('eip155:');
}

// EIP-3009 transferWithAuthorization is the only EVM asset-transfer method this
// zero-dep wrapper signs. Skip Permit2 siblings (extra.assetTransferMethod ===
// 'permit2') — signing typed data against them yields a payload the facilitator
// rejects.
function isEip3009Accept(accept) {
	if (!isEvmNetwork(accept?.network)) return false;
	if (accept.scheme && accept.scheme !== 'exact') return false;
	const method = accept?.extra?.assetTransferMethod;
	return !method || method === 'eip3009';
}

// Auth-hint placeholders (amount "0" / extra.authRequired) are never payable.
function isPayable(accept) {
	if (!accept || typeof accept !== 'object') return false;
	if (accept.extra?.authRequired != null) return false;
	return String(accept.amount ?? accept.maxAmountRequired ?? '') !== '0';
}

function normalizeAccept(accept) {
	const amount = accept.amount ?? accept.maxAmountRequired;
	return amount != null && accept.amount == null ? { ...accept, amount: String(amount) } : accept;
}

/**
 * Read the challenge envelope from a 402 Response.
 * @param {Response} response
 * @returns {Promise<{ accepts: any[], resource: any, raw: any } | null>}
 */
export async function parseChallenge(response) {
	let envelope = b64decodeJson(
		response.headers.get('payment-required') || response.headers.get('x-payment-required'),
	);
	if (!envelope) {
		const ct = response.headers.get('content-type') || '';
		if (!ct.includes('json')) return null;
		try {
			envelope = await response.clone().json();
		} catch {
			return null;
		}
	}
	const accepts = Array.isArray(envelope?.accepts) ? envelope.accepts.map(normalizeAccept) : [];
	return { accepts, resource: envelope?.resource || null, raw: envelope };
}

/**
 * Select the payment requirement this wrapper can satisfy. Prefers Base USDC
 * (the spec target), then any other EVM EIP-3009 USDC entry.
 * @param {any[]} accepts
 * @param {{ preferNetwork?: string }} [opts]
 * @returns {any | null}
 */
export function selectRequirement(accepts, { preferNetwork } = {}) {
	const payable = accepts.filter((a) => isPayable(a) && isEip3009Accept(a));
	if (!payable.length) return null;
	if (preferNetwork) {
		const want = payable.find((a) => a.network === preferNetwork);
		if (want) return want;
	}
	const base = payable.find((a) => a.network === NETWORK_BASE);
	return base || payable[0];
}

/** Atomic price → USD float, honouring the asset's declared decimals (default 6). */
export function amountToUsd(accept) {
	const decimals = Number(accept?.extra?.decimals ?? 6);
	const atomic = Number(accept?.amount ?? 0);
	return atomic / 10 ** decimals;
}

/* ─────────────────────────── payment client ────────────────────────────── */

const EVM_CHAIN_IDS = {
	'eip155:8453': 8453,
	'eip155:84532': 84532,
	'eip155:42161': 42161,
	'eip155:1': 1,
	'eip155:10': 10,
};

function randomNonce() {
	const arr = new Uint8Array(32);
	(globalThis.crypto || crypto).getRandomValues(arr);
	return '0x' + Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function b64encode(obj) {
	const json = JSON.stringify(obj);
	if (typeof Buffer !== 'undefined') return Buffer.from(json, 'utf8').toString('base64');
	return btoa(unescape(encodeURIComponent(json)));
}

function buildEip3009TypedData({ accept, payerAddress, chainId, nowSeconds, nonce }) {
	const now = nowSeconds != null ? nowSeconds : Math.floor(Date.now() / 1000);
	const validBefore = now + (Number(accept.maxTimeoutSeconds) || 600);
	const domain = {
		name: accept.extra?.name || 'USD Coin',
		version: accept.extra?.version || '2',
		chainId,
		verifyingContract: accept.asset,
	};
	const types = {
		EIP712Domain: [
			{ name: 'name', type: 'string' },
			{ name: 'version', type: 'string' },
			{ name: 'chainId', type: 'uint256' },
			{ name: 'verifyingContract', type: 'address' },
		],
		TransferWithAuthorization: [
			{ name: 'from', type: 'address' },
			{ name: 'to', type: 'address' },
			{ name: 'value', type: 'uint256' },
			{ name: 'validAfter', type: 'uint256' },
			{ name: 'validBefore', type: 'uint256' },
			{ name: 'nonce', type: 'bytes32' },
		],
	};
	// The x402 v2 `exact` PaymentRequirements schema requires the authorization's
	// numeric fields as decimal STRINGS. The EIP-712 hash treats them as uint256
	// either way, so the signature stays valid.
	const authorization = {
		from: payerAddress,
		to: accept.payTo,
		value: String(accept.amount),
		validAfter: '0',
		validBefore: String(validBefore),
		nonce: nonce || randomNonce(),
	};
	return {
		typedData: { primaryType: 'TransferWithAuthorization', types, domain, message: authorization },
		authorization,
	};
}

// Assemble the x402 v2 `exact`-scheme PaymentPayload. The shape mirrors the
// canonical ExactEvmScheme — `{ x402Version, scheme, network, accepted, payload }`
// with no extra keys, since the facilitator's schema union rejects anything that
// doesn't match a branch.
function buildPaymentPayload({ accept, signature, authorization }) {
	return {
		x402Version: 2,
		scheme: accept.scheme || 'exact',
		network: accept.network,
		accepted: accept,
		payload: { authorization, signature },
	};
}

async function createPaymentHeader({ accept, adapter, nowSeconds, nonce }) {
	if (!isEvmNetwork(accept.network)) {
		throw new Error(
			`x402: network "${accept.network}" is not locally signable (EVM EIP-3009 / USDC on Base only)`,
		);
	}
	const chainId = EVM_CHAIN_IDS[accept.network];
	if (!chainId) throw new Error(`x402: unknown EVM chain for network "${accept.network}"`);
	if (!accept.asset) throw new Error('x402: payment requirement is missing an asset address');

	const payerAddress = await adapter.getAddress();
	const { typedData, authorization } = buildEip3009TypedData({
		accept,
		payerAddress,
		chainId,
		nowSeconds,
		nonce,
	});
	const signature = await adapter.signTypedData(typedData);
	const payload = buildPaymentPayload({ accept, signature, authorization });
	return b64encode(payload);
}

/* ────────────────────────────── wallet adapter ─────────────────────────── */

function isEip1193(w) {
	return w && typeof w === 'object' && typeof w.request === 'function';
}

/**
 * Build a Node signer from a raw private key. Signs EIP-712 typed data locally
 * with the inlined secp256k1 implementation — no external wallet library.
 * @param {string|Uint8Array} pk 32-byte private key (0x-hex or bytes)
 * @returns {{ address: string, signTypedData: (td: any) => Promise<string> }}
 */
export function privateKeyToWallet(pk) {
	const key = normalizePrivateKey(pk);
	const address = toChecksumAddress(privateKeyToAddress(key));
	return {
		address,
		async signTypedData(typedData) {
			return signDigest(eip712Digest(typedData), key);
		},
	};
}

async function resolveAddress(wallet) {
	if (typeof wallet === 'string') return privateKeyToWallet(wallet).address;
	if (isEip1193(wallet)) {
		const accounts = await wallet.request({ method: 'eth_requestAccounts' });
		const addr = Array.isArray(accounts) ? accounts[0] : null;
		if (!addr) throw new Error('x402: wallet returned no account');
		return addr;
	}
	const addr = wallet?.address || wallet?.account?.address;
	if (!addr) throw new Error('x402: wallet object must expose an `address`');
	return addr;
}

const USER_REJECTED = /user rejected|user denied|reject|cancell?ed|4001/i;

function adaptWallet(wallet) {
	if (wallet == null) throw new Error('x402: a wallet is required');

	let cachedAddress = null;
	const getAddress = async () => {
		if (!cachedAddress) cachedAddress = await resolveAddress(wallet);
		return cachedAddress;
	};

	const signTypedData = async (typedData) => {
		try {
			if (typeof wallet === 'string') {
				return await privateKeyToWallet(wallet).signTypedData(typedData);
			}
			if (isEip1193(wallet)) {
				const from = await getAddress();
				return await wallet.request({
					method: 'eth_signTypedData_v4',
					params: [from, JSON.stringify(typedData)],
				});
			}
			if (typeof wallet.signTypedData === 'function') {
				return await wallet.signTypedData(typedData);
			}
			throw new Error('x402: wallet does not support signTypedData');
		} catch (err) {
			if (USER_REJECTED.test(err?.message || String(err))) {
				throw new Error('x402: user rejected payment');
			}
			throw err;
		}
	};

	return { getAddress, signTypedData };
}

/* ──────────────────────────── paid fetch wrapper ───────────────────────── */

const DEFAULT_MAX_PAYMENT_USD = 0.1;
const DEFAULT_TIMEOUT_MS = 15000;

function withTimeout(promise, ms, label) {
	if (!ms || ms <= 0) return promise;
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(new Error(`x402: ${label} timed out after ${ms}ms`)), ms);
		promise.then(
			(v) => {
				clearTimeout(t);
				resolve(v);
			},
			(e) => {
				clearTimeout(t);
				reject(e);
			},
		);
	});
}

/**
 * Wrap a wallet into a fetch-compatible function that automatically pays x402
 * challenges. On a 402 the wrapper parses the challenge, signs a USDC-on-Base
 * EIP-3009 authorization, and retries with the X-PAYMENT proof.
 *
 *   const pay = withX402(privateKey, { maxPaymentUsd: 0.10 });
 *   const res = await pay('https://api.example.com/paid', { method: 'POST', body });
 *
 * @param {string|object} wallet  0x private key, EIP-1193 provider, or signer object
 * @param {{ maxPaymentUsd?: number, network?: string, timeout?: number, onPayment?: Function }} [options]
 * @returns {typeof fetch}
 */
export function withX402(wallet, options = {}) {
	const baseFetch = globalThis.fetch?.bind(globalThis);
	if (typeof baseFetch !== 'function') {
		throw new Error('x402: no global fetch available (Node >= 18 or a modern browser is required)');
	}
	const opts = options && typeof options === 'object' ? options : {};
	const adapter = adaptWallet(wallet);
	const maxPaymentUsd = Number.isFinite(opts.maxPaymentUsd)
		? opts.maxPaymentUsd
		: DEFAULT_MAX_PAYMENT_USD;
	const timeout = Number.isFinite(opts.timeout) ? opts.timeout : DEFAULT_TIMEOUT_MS;
	const onPayment = typeof opts.onPayment === 'function' ? opts.onPayment : null;
	const preferNetwork = opts.network || opts.preferNetwork || null;

	return async function paidFetch(input, init) {
		const first = await baseFetch(input, init);
		if (first.status !== 402) return first;

		const challenge = await parseChallenge(first);
		if (!challenge || !challenge.accepts.length) {
			throw new Error('x402: server returned 402 but no parseable payment challenge was found');
		}

		const accept = selectRequirement(challenge.accepts, { preferNetwork });
		if (!accept) {
			throw new Error(
				'x402: server requires payment but no supported network/asset was found in accepts[]. Supported: USDC on Base mainnet.',
			);
		}

		const usd = amountToUsd(accept);
		if (usd > maxPaymentUsd) {
			throw new Error(
				`x402: payment of $${usd.toFixed(4)} exceeds maxPaymentUsd limit of $${maxPaymentUsd.toFixed(4)} — raise the limit to authorize this call`,
			);
		}

		const requestUrl =
			typeof input === 'string' ? input : input?.url || challenge.resource?.url || String(input);
		const payTo = accept.payTo;
		if (onPayment) onPayment({ amount: usd, to: payTo, requestUrl });

		const xPayment = await withTimeout(
			createPaymentHeader({ accept, adapter }),
			timeout,
			'payment authorization',
		);

		const retryHeaders = new Headers(
			init?.headers || (typeof input === 'object' ? input.headers : undefined),
		);
		retryHeaders.set('X-PAYMENT', xPayment);
		const retried = await baseFetch(input, { ...init, headers: retryHeaders });

		if (retried.status === 402) {
			throw new Error(
				'x402: payment submitted but server still returned 402 — check payment amount and recipient',
			);
		}
		return retried;
	};
}

export default withX402;
