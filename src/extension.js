// vscode-x402 — VS Code extension entry. Registers the bazaar tree, the
// inspect/pay/scaffold commands, the wallet status bar, and secret-storage
// wallet management. Payments use the vendored, zero-dep x402-fetch; discovery
// uses whatever bazaar host the user configures (x402.bazaarUrl). Inspecting or
// paying a specific endpoint URL needs no configuration at all. No mocks.

import * as vscode from 'vscode';
import { BazaarProvider } from './tree.js';
import { inspectEndpoint, summarize } from './inspect.js';
import { showService } from './panel.js';
import { setKey, clearKey, getAddress } from './wallet.js';
import { scaffoldEndpoint } from './scaffold.js';

let output;
let statusBar;

export function activate(context) {
	output = vscode.window.createOutputChannel('x402');
	const provider = new BazaarProvider();
	const tree = vscode.window.createTreeView('x402.bazaar', { treeDataProvider: provider });

	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBar.command = 'x402.setWalletKey';
	context.subscriptions.push(output, tree, statusBar);
	refreshStatusBar(context);

	const reg = (id, fn) =>
		context.subscriptions.push(vscode.commands.registerCommand(id, fn));

	reg('x402.refresh', () => provider.refresh());

	reg('x402.search', async () => {
		const q = await vscode.window.showInputBox({
			title: 'Search the x402 bazaar',
			prompt: 'Keywords (empty to list everything)',
		});
		if (q === undefined) return;
		provider.setQuery(q.trim());
	});

	reg('x402.setFilters', () => setFilters());

	reg('x402.setBazaarUrl', () => setBazaarUrl(provider));

	reg('x402.inspect', async (preset) => {
		const url =
			typeof preset === 'string'
				? preset
				: await vscode.window.showInputBox({
						title: 'Inspect x402 endpoint',
						prompt: 'Endpoint URL — decodes its 402 payment challenge',
						placeHolder: 'https://your-api.example.com/x402/endpoint',
						validateInput: (v) => (isUrl(v) ? null : 'Enter a valid http(s) URL'),
					});
		if (!url) return;
		await runInspect(url);
	});

	reg('x402.openService', (item) => {
		if (item) showService(context, item);
	});

	reg('x402.pay', async (node) => {
		// Invoked from the tree inline action (node.command.arguments[0]) or palette.
		const item = node?.command?.arguments?.[0] || node;
		if (item?.resource) {
			showService(context, item);
		} else {
			const url = await vscode.window.showInputBox({
				title: 'Pay & call x402 endpoint',
				prompt: 'Endpoint URL',
				placeHolder: 'https://your-api.example.com/x402/endpoint',
				validateInput: (v) => (isUrl(v) ? null : 'Enter a valid http(s) URL'),
			});
			if (url) showService(context, syntheticItem(url));
		}
	});

	reg('x402.setWalletKey', async () => {
		const address = await setKey(context);
		if (address) {
			vscode.window.showInformationMessage(`x402 wallet set: ${address}`);
			refreshStatusBar(context);
		}
	});

	reg('x402.clearWalletKey', async () => {
		await clearKey(context);
		vscode.window.showInformationMessage('x402 wallet key cleared.');
		refreshStatusBar(context);
	});

	reg('x402.scaffoldEndpoint', () => scaffoldEndpoint());

	provider.refresh();
}

async function refreshStatusBar(context) {
	const address = await getAddress(context);
	if (address) {
		statusBar.text = `$(key) x402 ${address.slice(0, 6)}…${address.slice(-4)}`;
		statusBar.tooltip = `x402 wallet: ${address}\nClick to change`;
	} else {
		statusBar.text = '$(key) x402: no wallet';
		statusBar.tooltip = 'No x402 wallet key set — click to set one';
	}
	statusBar.show();
}

async function runInspect(url) {
	output.clear();
	output.show(true);
	output.appendLine(`Inspecting ${url}`);
	const network = vscode.workspace.getConfiguration('x402').get('network');
	try {
		const result = await inspectEndpoint(url, { preferNetwork: network });
		summarize(result).forEach((l) => output.appendLine(l));
	} catch (e) {
		output.appendLine(`Error: ${e?.message || e}`);
	}
}

async function setBazaarUrl(provider) {
	const cfg = vscode.workspace.getConfiguration('x402');
	const current = cfg.get('bazaarUrl', '');
	const url = await vscode.window.showInputBox({
		title: 'x402 — Bazaar discovery host',
		prompt: 'Origin that serves /api/bazaar/list and /api/bazaar/search. Leave blank to disable discovery.',
		placeHolder: 'https://your-bazaar.example.com',
		value: current,
		validateInput: (v) => (!v || isUrl(v) ? null : 'Enter a valid http(s) URL, or leave blank'),
	});
	if (url === undefined) return;
	await cfg.update('bazaarUrl', url.trim(), vscode.ConfigurationTarget.Global);
	provider.refresh();
}

async function setFilters() {
	const cfg = vscode.workspace.getConfiguration('x402');
	const current = cfg.get('filters', { type: 'http' });

	const type = await vscode.window.showQuickPick(
		[
			{ label: 'http', description: 'Paid HTTP APIs' },
			{ label: 'mcp', description: 'Paid MCP tools' },
		],
		{ title: 'Bazaar type', placeHolder: current.type || 'http' },
	);
	if (!type) return;

	const maxPrice = await vscode.window.showInputBox({
		title: 'Max price (USDC atomics, blank = any)',
		value: current.maxPrice != null ? String(current.maxPrice) : '',
		validateInput: (v) => (!v || /^\d+$/.test(v) ? null : 'digits only'),
	});
	if (maxPrice === undefined) return;

	const tag = await vscode.window.showInputBox({
		title: 'Tag filter (blank = any)',
		value: current.tag || '',
	});
	if (tag === undefined) return;

	const next = { type: type.label };
	if (maxPrice) next.maxPrice = Number(maxPrice);
	if (tag.trim()) next.tag = tag.trim();
	await cfg.update('filters', next, vscode.ConfigurationTarget.Global);
	vscode.commands.executeCommand('x402.refresh');
}

function syntheticItem(url) {
	return {
		type: 'http',
		resource: url,
		serviceName: '',
		description: 'Manually entered endpoint.',
		accepts: [],
		tags: [],
		networks: [],
		minPriceLabel: '',
	};
}

function isUrl(v) {
	try {
		const u = new URL(v);
		return u.protocol === 'http:' || u.protocol === 'https:';
	} catch {
		return false;
	}
}

export function deactivate() {}
