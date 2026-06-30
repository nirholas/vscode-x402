// Buyer-side discovery client. Talks to a bazaar discovery API
// (/api/bazaar/list, /api/bazaar/search) that merges + normalises x402 services
// across facilitators. The origin is configured by the user via the
// `x402.bazaarUrl` setting — there is no built-in default, so discovery is
// opt-in. Inspecting or paying an arbitrary URL needs no discovery host at all.

import * as vscode from 'vscode';

class BazaarNotConfiguredError extends Error {}

function origin() {
	const url = (vscode.workspace.getConfiguration('x402').get('bazaarUrl', '') || '').trim();
	if (!url) {
		throw new BazaarNotConfiguredError(
			'No bazaar discovery host is set. Configure "x402.bazaarUrl" in Settings to browse and search services. Inspecting or paying a specific endpoint URL needs no bazaar host.',
		);
	}
	return url.replace(/\/+$/, '');
}

export { BazaarNotConfiguredError };

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
