// Wallet key handling. The EVM private key lives ONLY in VS Code SecretStorage
// (OS keychain) — never in settings.json, never on disk in plaintext. From the
// key we derive the public address with the bundled, zero-dep signer so we can
// show the user which account they're paying from.

import * as vscode from 'vscode';
import { privateKeyToWallet } from '../../x402-fetch/src/index.js';

const SECRET_KEY = 'threewsX402.walletPrivateKey';

function normalizePk(raw) {
	const pk = raw.trim();
	if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
		throw new Error('Expected a 0x-prefixed 32-byte (64 hex char) EVM private key.');
	}
	return pk;
}

/** Prompt for and store an EVM private key. Returns the derived address. */
export async function setKey(context) {
	const raw = await vscode.window.showInputBox({
		title: 'x402 — Set Wallet Key',
		prompt: 'EVM private key (0x + 64 hex). Stored in the OS keychain, never in settings or files.',
		password: true,
		ignoreFocusOut: true,
		validateInput(value) {
			if (!value) return 'Required';
			return /^0x[0-9a-fA-F]{64}$/.test(value.trim())
				? null
				: 'Must be 0x followed by 64 hex characters';
		},
	});
	if (!raw) return null;
	const pk = normalizePk(raw);
	// Validate it derives a real address before persisting.
	const { address } = privateKeyToWallet(pk);
	await context.secrets.store(SECRET_KEY, pk);
	return address;
}

/** Remove the stored key. */
export async function clearKey(context) {
	await context.secrets.delete(SECRET_KEY);
}

/** The stored private key, or null. */
export async function getKey(context) {
	return (await context.secrets.get(SECRET_KEY)) || null;
}

/** Derived address for the stored key, or null if none set. */
export async function getAddress(context) {
	const pk = await getKey(context);
	if (!pk) return null;
	try {
		return privateKeyToWallet(pk).address;
	} catch {
		return null;
	}
}
