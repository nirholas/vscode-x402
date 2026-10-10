// Wallet key handling. Private keys live ONLY in VS Code SecretStorage (the OS
// keychain), never in settings.json, never on disk in plaintext. The extension
// holds two independent, optional keys so it can pay on both rails:
//   • an EVM key   → USDC EIP-3009 on Base and other EVM chains
//   • a Solana key → USDC or $THREE (SPL, `exact` scheme) on Solana
// From each key we derive the public address so we can show which account pays.

import * as vscode from 'vscode';
import { privateKeyToWallet } from '../../x402-fetch/src/index.js';
import { solanaAddressFromSecret } from './solana.js';

const SECRET_EVM = 'threewsX402.walletPrivateKey';
const SECRET_SOL = 'threewsX402.solanaSecretKey';

// ---------------------------------------------------------------------------
// EVM
// ---------------------------------------------------------------------------

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
		title: 'x402: Set EVM Wallet Key',
		prompt: 'EVM private key (0x + 64 hex). Stored in the OS keychain, never in settings or files.',
		password: true,
		ignoreFocusOut: true,
		validateInput(value) {
			if (!value) return 'Required';
			return /^0x[0-9a-fA-F]{64}$/.test(value.trim()) ? null : 'Must be 0x followed by 64 hex characters';
		},
	});
	if (!raw) return null;
	const pk = normalizePk(raw);
	const { address } = privateKeyToWallet(pk); // validate it derives before persisting
	await context.secrets.store(SECRET_EVM, pk);
	return address;
}

export async function clearKey(context) {
	await context.secrets.delete(SECRET_EVM);
}

export async function getKey(context) {
	return (await context.secrets.get(SECRET_EVM)) || null;
}

export async function getAddress(context) {
	const pk = await getKey(context);
	if (!pk) return null;
	try {
		return privateKeyToWallet(pk).address;
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Solana
// ---------------------------------------------------------------------------

/** Prompt for and store a Solana secret key. Returns the derived address. */
export async function setSolanaKey(context) {
	const raw = await vscode.window.showInputBox({
		title: 'x402: Set Solana Wallet Key',
		prompt: 'Solana secret key (base58, or a JSON byte array). Stored in the OS keychain, never in settings or files.',
		password: true,
		ignoreFocusOut: true,
		validateInput(value) {
			return value && value.trim() ? null : 'Required';
		},
	});
	if (!raw) return null;
	const secret = raw.trim();
	let address;
	try {
		address = await solanaAddressFromSecret(secret); // validate before persisting
	} catch (e) {
		vscode.window.showErrorMessage(`Invalid Solana key: ${e?.message || e}`);
		return null;
	}
	await context.secrets.store(SECRET_SOL, secret);
	return address;
}

export async function clearSolanaKey(context) {
	await context.secrets.delete(SECRET_SOL);
}

export async function getSolanaKey(context) {
	return (await context.secrets.get(SECRET_SOL)) || null;
}

export async function getSolanaAddress(context) {
	const secret = await getSolanaKey(context);
	if (!secret) return null;
	try {
		return await solanaAddressFromSecret(secret);
	} catch {
		return null;
	}
}
