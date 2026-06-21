// Scaffold a new paid x402 endpoint that follows the repo's canonical
// paidEndpoint() pattern (api/_lib/x402-paid-endpoint.js). Generates a working
// handler file in the open workspace and opens it.

import * as vscode from 'vscode';

function template({ slug, fnName, priceUsd, description }) {
	const priceAtomics = Math.round(Number(priceUsd) * 1e6);
	return `// ${slug} — paid x402 endpoint. Buyers pay USDC; the call runs only after
// settlement. Wired to the shared paidEndpoint() x402 dance.
//
//   GET|POST /api/x402/${slug}

import { paidEndpoint } from '../_lib/x402-paid-endpoint.js';
import { buildBazaarSchema } from '../_lib/x402-spec.js';
import { withService } from '../_lib/x402/bazaar-helpers.js';

const RESOURCE_URL = 'https://three.ws/api/x402/${slug}';

const paid = paidEndpoint({
	route: '/api/x402/${slug}',
	method: 'POST',
	// $${Number(priceUsd).toFixed(6)} in USDC atomics (6 decimals).
	priceAtomics: ${priceAtomics},
	networks: ['base'],
	description: ${JSON.stringify(description)},
	service: withService({
		serviceName: ${JSON.stringify(slug)},
		tags: ['x402', 'paid'],
	}),
	bazaar: {
		description: ${JSON.stringify(description)},
		useCases: ['x402 paid api'],
		input: { type: 'json', example: {}, schema: { type: 'object', additionalProperties: true } },
		output: { type: 'json', example: {} },
		schema: buildBazaarSchema({ method: 'POST', bodySchema: { type: 'object', additionalProperties: true } }),
		resource: RESOURCE_URL,
	},
	resourceUrlBuilder: () => RESOURCE_URL,

	// Runs ONLY after the buyer's USDC settles. Return JSON; throw an Error with
	// a .status for handled failures.
	async handler({ req }) {
		const body = await readJson(req);
		// Replace this echo with the real work. It returns the validated request
		// so the endpoint is wired end-to-end from the first deploy.
		return {
			ok: true,
			service: ${JSON.stringify(slug)},
			received: body,
		};
	},
});

async function readJson(req) {
	const chunks = [];
	for await (const c of req) chunks.push(c);
	const raw = Buffer.concat(chunks).toString('utf8');
	return raw ? JSON.parse(raw) : {};
}

export default paid;
export const config = { api: { bodyParser: false } };
`;
}

export async function scaffoldEndpoint() {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders?.length) {
		vscode.window.showErrorMessage('Open a workspace folder to scaffold an endpoint into.');
		return;
	}

	const slug = await vscode.window.showInputBox({
		title: 'Scaffold paid endpoint — slug',
		prompt: 'URL slug, e.g. "summarize" → /api/x402/summarize',
		validateInput: (v) =>
			/^[a-z0-9][a-z0-9-]*$/.test((v || '').trim()) ? null : 'lowercase letters, digits, hyphens',
	});
	if (!slug) return;

	const priceUsd = await vscode.window.showInputBox({
		title: 'Price per call (USD)',
		value: '0.01',
		validateInput: (v) => (Number(v) > 0 ? null : 'must be a positive number'),
	});
	if (!priceUsd) return;

	const description = await vscode.window.showInputBox({
		title: 'Description',
		prompt: 'What does this endpoint do? (shown in the bazaar)',
		value: `${slug} service`,
	});
	if (description == null) return;

	const cleanSlug = slug.trim();
	const content = template({
		slug: cleanSlug,
		fnName: cleanSlug.replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
		priceUsd,
		description,
	});

	const root = folders[0].uri;
	const target = vscode.Uri.joinPath(root, 'api', 'x402', `${cleanSlug}.js`);
	try {
		await vscode.workspace.fs.stat(target);
		const ow = await vscode.window.showWarningMessage(
			`api/x402/${cleanSlug}.js already exists. Overwrite?`,
			'Overwrite',
			'Cancel',
		);
		if (ow !== 'Overwrite') return;
	} catch {
		/* doesn't exist — good */
	}

	await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf8'));
	const doc = await vscode.workspace.openTextDocument(target);
	await vscode.window.showTextDocument(doc);
	vscode.window.showInformationMessage(
		`Scaffolded /api/x402/${cleanSlug} — it returns a wired echo response; replace the handler body with real work.`,
	);
}
