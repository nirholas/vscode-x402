// Pay-per-call flow. Pre-checks the 402 to show the exact USD amount, asks for
// confirmation (honouring the spend cap), then performs the real paid request
// with @three-ws/x402-fetch and surfaces the settlement receipt.

import * as vscode from 'vscode';
import { withX402, privateKeyToWallet } from '../../x402-fetch/src/index.js';
import { amountToUsd } from '../../x402-fetch/src/parse-challenge.js';
import { getKey, setKey } from './wallet.js';
import { inspectEndpoint } from './inspect.js';

function config() {
	const c = vscode.workspace.getConfiguration('threewsX402');
	return {
		maxPaymentUsd: c.get('maxPaymentUsd', 0.1),
		confirmEachPayment: c.get('confirmEachPayment', true),
		network: c.get('network', 'eip155:8453'),
	};
}

function decodeReceipt(res) {
	const raw = res.headers.get('x-payment-response') || res.headers.get('payment-response');
	if (!raw) return null;
	try {
		return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
	} catch {
		return null;
	}
}

/**
 * @param {{ url:string, method?:string, body?:string, serviceName?:string }} req
 * @returns {Promise<{ ok:boolean, status:number, amountUsd:number|null, address:string, receipt:any, bodyText:string }|null>}
 */
export async function payAndCall(context, req) {
	const cfg = config();

	let pk = await getKey(context);
	if (!pk) {
		const choice = await vscode.window.showWarningMessage(
			'No wallet key set. Set one to pay for x402 endpoints?',
			'Set Wallet Key',
			'Cancel',
		);
		if (choice !== 'Set Wallet Key') return null;
		await setKey(context);
		pk = await getKey(context);
		if (!pk) return null;
	}

	const { address } = privateKeyToWallet(pk);
	const method = (req.method || 'GET').toUpperCase();
	const init = { method, headers: { accept: 'application/json' } };
	if (req.body != null && method !== 'GET' && method !== 'HEAD') {
		init.headers['content-type'] = 'application/json';
		init.body = req.body;
	}

	// Pre-check the challenge so the confirmation shows a real amount.
	const probe = await inspectEndpoint(req.url, { method, preferNetwork: cfg.network });
	if (probe.status !== 402) {
		// Free or non-paid endpoint — just run it, no signing.
		const res = await fetch(req.url, init);
		return finalize(res, { amountUsd: 0, address });
	}
	if (!probe.chosen) {
		throw new Error(
			'This endpoint requires payment but offers no requirement this wallet can satisfy (needs USDC EIP-3009 on an EVM network).',
		);
	}

	const amountUsd = amountToUsd(probe.chosen);
	if (amountUsd > cfg.maxPaymentUsd) {
		const raise = await vscode.window.showWarningMessage(
			`This call costs $${amountUsd.toFixed(4)}, above your cap of $${cfg.maxPaymentUsd.toFixed(4)}.`,
			'Raise cap & pay',
			'Cancel',
		);
		if (raise !== 'Raise cap & pay') return null;
	} else if (cfg.confirmEachPayment) {
		const go = await vscode.window.showInformationMessage(
			`Pay $${amountUsd.toFixed(6)} from ${short(address)} to call ${req.serviceName || req.url}?`,
			{ modal: true },
			'Pay & call',
		);
		if (go !== 'Pay & call') return null;
	}

	const paidFetch = withX402(pk, {
		maxPaymentUsd: Math.max(cfg.maxPaymentUsd, amountUsd),
		network: cfg.network,
	});

	const res = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: `Paying $${amountUsd.toFixed(6)} & calling…` },
		() => paidFetch(req.url, init),
	);
	return finalize(res, { amountUsd, address });
}

async function finalize(res, { amountUsd, address }) {
	const bodyText = await res.text();
	return {
		ok: res.ok,
		status: res.status,
		amountUsd,
		address,
		receipt: decodeReceipt(res),
		bodyText,
	};
}

function short(addr) {
	return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
}
