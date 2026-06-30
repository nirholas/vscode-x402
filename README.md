# x402 for VS Code

Browse an [x402](https://github.com/coinbase/x402) bazaar, decode
`402 Payment Required` challenges, and pay-per-call paid APIs and MCP tools with
USDC — without leaving your editor.

x402 is a payment protocol for developers and agents: a server answers a request
with `402 Payment Required` and a machine-readable challenge, the caller signs a
USDC authorization, and retries with proof of payment. This extension brings that
loop into VS Code, where the people wiring up and calling paid endpoints work.

It has **no dependency on any specific provider**. Point it at any compliant x402
endpoint, or at any bazaar that serves the discovery API. Discovery is optional;
inspecting and paying a single endpoint URL needs zero configuration.

## Features

- **Inspect an endpoint** — paste any URL and decode its 402 challenge: every
  accepted network, asset, scheme, price (in USD), and `payTo`, with the one
  this wallet can actually satisfy flagged. No configuration required.
- **Pay & call** — make a real paid request. The exact USD amount is shown and
  confirmed before signing; a spending cap blocks anything above your limit. The
  response body and on-chain settlement receipt (tx hash) are rendered inline.
- **Bazaar sidebar** — when you set a discovery host (`x402.bazaarUrl`), the
  sidebar lists paid x402 HTTP APIs and MCP tools from it. Filter by type, price,
  and tag; full-text search. Left blank, the sidebar prompts you to set a host —
  it ships pointing nowhere.
- **Secure wallet** — your EVM private key lives only in VS Code SecretStorage
  (the OS keychain). Never in settings, never on disk in plaintext. The status
  bar shows the derived address.
- **Scaffold a paid endpoint** — generate a self-contained Node handler that
  answers an unpaid request with a 402 challenge and runs your work only after
  payment verifies. No framework or monorepo dependency.

## Setup

1. Install the extension. The **x402 Bazaar** view appears in the activity bar.
2. To pay, run **x402: Set Wallet Key** and paste a funded Base USDC private key
   (`0x` + 64 hex). It is stored in your OS keychain, never on disk in plaintext.

That's it for paying any endpoint you have a URL for. To browse a marketplace,
run **x402: Set Bazaar Discovery Host** (or set `x402.bazaarUrl`) to an origin
that serves `/api/bazaar/list` and `/api/bazaar/search`.

## Use it against any x402 endpoint

No bazaar, no account, no provider lock-in:

1. Run **x402: Inspect Endpoint** and paste the endpoint URL, e.g.
   `https://your-api.example.com/x402/summarize`. The output channel shows the
   decoded 402 challenge — networks, assets, prices, `payTo`.
2. Run **x402: Pay & Call Endpoint**, paste the same URL, set the request body if
   it's a POST/MCP call, and confirm the amount. The extension signs a USDC
   EIP-3009 authorization, retries with the `X-PAYMENT` proof, and shows the
   response plus the settlement receipt.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `x402.bazaarUrl` | `""` | Discovery host for the bazaar sidebar. Blank disables discovery. |
| `x402.maxPaymentUsd` | `0.10` | Per-request spending cap, in USD. |
| `x402.confirmEachPayment` | `true` | Confirm the exact amount before signing. |
| `x402.network` | `eip155:8453` | Preferred CAIP-2 network (Base mainnet). |
| `x402.filters` | `{ "type": "http" }` | Default bazaar filters. |

## How payment works

The bundled, zero-dependency payment client (vendored in `src/vendor/`) signs a
USDC-on-Base **EIP-3009** `transferWithAuthorization` and retries the request
with the `X-PAYMENT` proof. The merchant settles on-chain and returns the work
plus a settlement receipt. The secp256k1 / keccak256 / EIP-712 stack is pure
JavaScript and depends only on Web Crypto (`crypto.subtle`), present in Node ≥ 18
and modern browsers. Solana-only services appear in the bazaar but are flagged as
not payable by this EVM signer.

## Development

```bash
npm install
npm run build        # bundle to dist/extension.js
npm run watch        # rebuild on change
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host.

Apache-2.0 · authored by [nirholas](https://github.com/nirholas) ·
[github.com/nirholas/vscode-x402](https://github.com/nirholas/vscode-x402)
