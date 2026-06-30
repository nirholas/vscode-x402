// Scaffold a new paid x402 endpoint. Generates a self-contained, framework-
// agnostic Node handler in the open workspace and opens it. The handler answers
// an unpaid request with a `402 Payment Required` challenge and runs the real
// work only after the buyer presents a valid X-PAYMENT header. No framework or
// monorepo dependency — it ships with a verifyPayment() stub you wire to your
// facilitator of choice.

import * as vscode from 'vscode';

function template({ slug, priceUsd, description }) {
	const priceAtomics = Math.round(Number(priceUsd) * 1e6);
	return `// ${slug} — paid x402 endpoint.
//
// Buyers first call this without payment and receive a 402 challenge describing
// the price and where to pay. They sign a USDC-on-Base EIP-3009 authorization,
// retry with an \`X-PAYMENT\` header, and the work below runs once payment
// verifies. Standalone Node handler — wire it into your server of choice
// (Express, Vercel, Cloudflare, etc.). Set RESOURCE_URL to the public URL this
// endpoint is reachable at.

// Public URL this endpoint is served from — buyers see it in the challenge.
const RESOURCE_URL = process.env.X402_RESOURCE_URL || 'https://your-api.example.com/x402/${slug}';

// USDC on Base mainnet (6 decimals). $${Number(priceUsd).toFixed(6)} per call.
const PRICE_ATOMICS = '${priceAtomics}';
const NETWORK = 'eip155:8453';
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const PAY_TO = process.env.X402_PAY_TO || '0xYourReceivingWalletAddressHere';

// The 402 challenge envelope a compliant x402 client parses.
function paymentChallenge() {
	return {
		x402Version: 2,
		error: 'payment required',
		resource: { url: RESOURCE_URL, description: ${JSON.stringify(description)} },
		accepts: [
			{
				scheme: 'exact',
				network: NETWORK,
				amount: PRICE_ATOMICS,
				asset: USDC_BASE,
				payTo: PAY_TO,
				maxTimeoutSeconds: 600,
				extra: { name: 'USD Coin', version: '2', decimals: 6 },
			},
		],
	};
}

// Verify the buyer's X-PAYMENT proof with your facilitator before doing work.
// Point FACILITATOR_VERIFY_URL at a facilitator's /verify endpoint (the CDP x402
// facilitator and compatible services expose one). Returns true when settled.
async function verifyPayment(xPaymentHeader) {
	const facilitator = process.env.X402_FACILITATOR_VERIFY_URL;
	if (!facilitator) {
		throw new Error(
			'Set X402_FACILITATOR_VERIFY_URL to a facilitator /verify endpoint to settle payments.',
		);
	}
	const res = await fetch(facilitator, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			x402Version: 2,
			paymentHeader: xPaymentHeader,
			paymentRequirements: paymentChallenge().accepts[0],
		}),
	});
	if (!res.ok) return false;
	const out = await res.json().catch(() => ({}));
	return out.isValid === true || out.valid === true || out.settled === true;
}

// The real work. Runs ONLY after payment verifies. Return a JSON-serialisable
// value — replace the echo with your service logic.
async function run(body) {
	return {
		ok: true,
		service: ${JSON.stringify(slug)},
		received: body,
	};
}

// Generic (req, res) handler. Adapt the request/response shims to your runtime.
export default async function handler(req, res) {
	const xPayment = req.headers['x-payment'] || req.headers['X-PAYMENT'];

	if (!xPayment) {
		res.statusCode = 402;
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify(paymentChallenge()));
		return;
	}

	let settled = false;
	try {
		settled = await verifyPayment(xPayment);
	} catch (err) {
		res.statusCode = 502;
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify({ error: err.message }));
		return;
	}

	if (!settled) {
		res.statusCode = 402;
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify({ ...paymentChallenge(), error: 'payment not verified' }));
		return;
	}

	const body = await readJson(req);
	const result = await run(body);
	res.statusCode = 200;
	res.setHeader('content-type', 'application/json');
	res.end(JSON.stringify(result));
}

async function readJson(req) {
	const chunks = [];
	for await (const c of req) chunks.push(c);
	const raw = Buffer.concat(chunks).toString('utf8');
	return raw ? JSON.parse(raw) : {};
}
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
		prompt: 'What does this endpoint do? (shown in the 402 challenge)',
		value: `${slug} service`,
	});
	if (description == null) return;

	const cleanSlug = slug.trim();
	const content = template({
		slug: cleanSlug,
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
		`Scaffolded api/x402/${cleanSlug}.js — set RESOURCE_URL, PAY_TO, and X402_FACILITATOR_VERIFY_URL, then replace run() with real work.`,
	);
}
