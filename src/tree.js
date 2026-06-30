// Sidebar tree of live bazaar services. Top level groups by facilitator source;
// children are services. Each leaf carries the normalised bazaar item so the
// detail/pay commands can act on it without re-fetching.

import * as vscode from 'vscode';
import * as bazaar from './bazaar.js';
import { BazaarNotConfiguredError } from './bazaar.js';

const STATE = {
	loading: 'loading',
	error: 'error',
	notConfigured: 'notConfigured',
	ready: 'ready',
};

export class BazaarProvider {
	constructor() {
		this._emitter = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._emitter.event;
		this._items = [];
		this._state = STATE.ready;
		this._message = '';
		this._query = '';
	}

	filters() {
		return vscode.workspace.getConfiguration('x402').get('filters', { type: 'http' });
	}

	setQuery(query) {
		this._query = query || '';
		this.refresh();
	}

	async refresh() {
		this._state = STATE.loading;
		this._emitter.fire();
		try {
			const res = this._query
				? await bazaar.search(this._query, this.filters())
				: await bazaar.list(this.filters());
			this._items = Array.isArray(res.items) ? res.items : [];
			this._errors = Array.isArray(res.errors) ? res.errors : [];
			this._state = STATE.ready;
		} catch (e) {
			this._state = e instanceof BazaarNotConfiguredError ? STATE.notConfigured : STATE.error;
			this._message = e?.message || String(e);
			this._items = [];
		}
		this._emitter.fire();
	}

	getTreeItem(node) {
		return node;
	}

	getChildren(node) {
		if (this._state === STATE.loading) {
			return [infoNode('Loading services…', new vscode.ThemeIcon('loading~spin'))];
		}
		if (this._state === STATE.notConfigured) {
			const node = infoNode(
				'Set a bazaar host to browse services',
				new vscode.ThemeIcon('gear'),
			);
			node.command = {
				command: 'x402.setBazaarUrl',
				title: 'Set Bazaar URL',
			};
			node.tooltip = this._message;
			return [node];
		}
		if (this._state === STATE.error) {
			return [infoNode(`Error: ${this._message}`, new vscode.ThemeIcon('error'))];
		}
		if (!node) {
			if (!this._items.length) {
				const label = this._query
					? `No matches for "${this._query}"`
					: 'No services found';
				return [infoNode(label, new vscode.ThemeIcon('info'))];
			}
			return this._items.map((item) => serviceNode(item));
		}
		return [];
	}
}

function infoNode(label, icon) {
	const node = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
	node.iconPath = icon;
	node.contextValue = 'x402info';
	return node;
}

function serviceNode(item) {
	const title = item.serviceName || labelFromUrl(item.resource) || item.resource;
	const node = new vscode.TreeItem(title, vscode.TreeItemCollapsibleState.None);
	const price = item.minPriceLabel || 'free';
	const nets = (item.networks || []).join(', ');
	node.description = [price, item.type, nets].filter(Boolean).join(' · ');
	node.tooltip = new vscode.MarkdownString(
		[
			`**${title}**`,
			'',
			item.description || '_no description_',
			'',
			`- **Resource:** \`${item.resource}\`${item.toolName ? ` · tool \`${item.toolName}\`` : ''}`,
			`- **Price:** ${price}`,
			`- **Networks:** ${nets || 'n/a'}`,
			`- **Facilitator:** ${item.facilitator || 'n/a'}`,
			item.tags?.length ? `- **Tags:** ${item.tags.join(', ')}` : '',
		]
			.filter(Boolean)
			.join('\n'),
	);
	node.iconPath = new vscode.ThemeIcon(item.type === 'mcp' ? 'plug' : 'globe');
	node.contextValue = 'x402service';
	node.command = {
		command: 'x402.openService',
		title: 'Open Service Details',
		arguments: [item],
	};
	return node;
}

function labelFromUrl(url) {
	try {
		const u = new URL(url);
		return `${u.host}${u.pathname}`.replace(/\/$/, '');
	} catch {
		return null;
	}
}
