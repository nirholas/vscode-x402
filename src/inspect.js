// Inspect any endpoint: do an unpaid request, and if it answers 402, decode the
// payment challenge into a readable summary using the same parser the payer
// uses. Reachable as a standalone command (paste a URL) or from a bazaar item.

import { parseChallenge, selectRequirement, amountToUsd } from './vendor/x402-fetch.js';

/**
 * @returns {Promise<{ status:number, paid:boolean, accepts:any[], chosen:any|null, resource:any, raw:any }>}
 */
export async function inspectEndpoint(url, { method = 'GET', preferNetwork } = {}) {
	const res = await fetch(url, {
		method,
		headers: { accept: 'application/json' },
		// MCP endpoints expect a body; for inspection a HEAD-ish GET is enough to
		// trigger the 402 on any compliant x402 merchant.
	});

	if (res.status !== 402) {
		return {
			status: res.status,
			paid: res.status >= 200 && res.status < 300,
			accepts: [],
			chosen: null,
			resource: null,
			raw: null,
		};
	}

	const parsed = await parseChallenge(res);
	const accepts = parsed?.accepts || [];
	const chosen = selectRequirement(accepts, { preferNetwork });
	return {
		status: 402,
		paid: false,
		accepts,
		chosen,
		resource: parsed?.resource || null,
		raw: parsed?.raw || null,
	};
}

/** Human summary lines for a parsed challenge. */
export function summarize(result) {
	if (result.status !== 402) {
		return [
			`Status: ${result.status}`,
			result.paid
				? 'No payment required — this endpoint answered without a 402.'
				: 'Endpoint did not return a 402 payment challenge.',
		];
	}
	const lines = ['Status: 402 Payment Required', ''];
	result.accepts.forEach((a, i) => {
		const usd = amountToUsd(a);
		const mark = a === result.chosen ? ' ← payable by this wallet' : '';
		lines.push(
			`#${i + 1} ${a.network || '?'} · ${a.scheme || 'exact'} · $${usd.toFixed(6)} ${shortAsset(a.asset)}${mark}`,
		);
		if (a.payTo) lines.push(`     payTo: ${a.payTo}`);
	});
	if (!result.chosen) {
		lines.push('', '⚠ No requirement this wallet can satisfy (needs an EVM EIP-3009 USDC accept).');
	}
	return lines;
}

function shortAsset(asset) {
	if (!asset) return '';
	return asset.length > 12 ? `${asset.slice(0, 6)}…${asset.slice(-4)}` : asset;
}
