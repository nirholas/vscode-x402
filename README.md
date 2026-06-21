# three.ws — x402 for VS Code

Browse the [x402](https://three.ws/x402.md) bazaar, decode `402 Payment Required`
challenges, and pay-per-call paid APIs and MCP tools with USDC — without leaving
your editor. Powered by [three.ws](https://three.ws).

x402 is a protocol for developers and agents, not end users — so unlike a 3D
viewer, this is genuinely editor-native: the people wiring up paid endpoints and
calling them live in VS Code.

## Features

- **Bazaar sidebar** — live list of paid x402 HTTP APIs and MCP tools, merged
  across every facilitator via the three.ws discovery proxy
  (`/api/bazaar/list`, `/api/bazaar/search`). Filter by type, price, and tag;
  full-text search.
- **Inspect an endpoint** — paste any URL and decode its 402 challenge: every
  accepted network, asset, scheme, price (in USD), and `payTo`, with the one
  this wallet can actually satisfy flagged.
- **Pay & call** — make a real paid request with
  [`@three-ws/x402-fetch`](../x402-fetch). The exact USD amount is shown and
  confirmed before signing; a spending cap blocks anything above your limit.
  The response body and on-chain settlement receipt (tx hash) are rendered
  inline.
- **Secure wallet** — your EVM private key lives only in VS Code SecretStorage
  (the OS keychain). Never in settings, never on disk in plaintext. The status
  bar shows the derived address.
- **Scaffold a paid endpoint** — generate a working `api/x402/<slug>.js` that
  follows the repo's canonical `paidEndpoint()` pattern, wired end-to-end from
  the first deploy.

## Setup

1. Install the extension and open the **x402 Bazaar** view in the activity bar.
2. Run **x402: Set Wallet Key** and paste a funded Base USDC private key
   (`0x` + 64 hex). It is stored in your OS keychain.
3. Browse or search the bazaar, open a service, and **Pay & call**.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `threewsX402.origin` | `https://three.ws` | Host of the bazaar discovery API. |
| `threewsX402.maxPaymentUsd` | `0.10` | Per-request spending cap, in USD. |
| `threewsX402.confirmEachPayment` | `true` | Confirm the exact amount before signing. |
| `threewsX402.network` | `eip155:8453` | Preferred CAIP-2 network (Base mainnet). |
| `threewsX402.filters` | `{ "type": "http" }` | Default bazaar filters. |

## How payment works

The wrapper signs a USDC-on-Base **EIP-3009** `transferWithAuthorization` and
retries the request with the `X-PAYMENT` proof. The merchant settles on-chain
and returns the work plus a settlement receipt. Solana-only services appear in
the bazaar but are flagged as not payable by this EVM signer.

## Development

```bash
npm install
npm run build        # bundle to dist/extension.js
npm run watch        # rebuild on change
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host.

Apache-2.0 · part of the [three.ws](https://three.ws) monorepo.
