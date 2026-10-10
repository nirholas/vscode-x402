// Buyer-side discovery client. Talks to the three.ws bazaar proxy
// (/api/bazaar/list, /api/bazaar/search), which merges + normalises results
// across every configured x402 facilitator. Mirrors public/x402-discover.js but
// runs in the extension host (Node global fetch).

import * as vscode from 'vscode';

function origin() {
	return vscode.workspace
		.getConfiguration('threewsX402')
		.get('origin', 'https://three.ws')
		.replace(/\/+$/, '');
}

function applyFilters(url, filters = {}) {
	const set = (k, v) => v != null && v !== '' && url.searchParams.set(k, String(v));
	set('type', filters.type || 'http');
	set('network', filters.network);
	set('maxPrice', filters.maxPrice);
	set('asset', filters.asset);
	set('extension', filters.extension);
	set('tag', filters.tag);
	set('sort', filters.sort);
	set('maxItems', filters.maxItems);
	set('limit', filters.limit);
}

async function call(url) {
	const res = await fetch(url.toString(), { headers: { accept: 'application/json' } });
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(body?.error_description || body?.error || `discovery HTTP ${res.status}`);
	}
	return body;
}

/** List bazaar services. Returns { type, count, items[], sources, errors }. */
export async function list(filters = {}) {
	const url = new URL(`${origin()}/api/bazaar/list`);
	applyFilters(url, filters);
	return call(url);
}

/** Full-text search across the bazaar. Same envelope as list(). */
export async function search(query, filters = {}) {
	const url = new URL(`${origin()}/api/bazaar/search`);
	if (query) url.searchParams.set('query', query);
	applyFilters(url, filters);
	return call(url);
}
