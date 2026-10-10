# three.ws — x402 for VS Code

<!-- three.ws:badges -->
[![GitHub stars](https://img.shields.io/github/stars/nirholas/vscode-x402?style=flat&logo=github)](https://github.com/nirholas/vscode-x402/stargazers) [![License](https://img.shields.io/github/license/nirholas/vscode-x402?style=flat)](https://github.com/nirholas/vscode-x402/blob/HEAD/LICENSE) [![Last commit](https://img.shields.io/github/last-commit/nirholas/vscode-x402?style=flat)](https://github.com/nirholas/vscode-x402/commits) [![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat)](https://github.com/nirholas/vscode-x402/pulls) [![AI agent friendly](https://img.shields.io/badge/AI%20agents-AGENTS.md%20%2B%20llms.txt-6d5dfc?style=flat)](https://github.com/nirholas/vscode-x402/blob/HEAD/AGENTS.md)
<!-- /three.ws:badges -->


Browse the [x402](https://three.ws/x402.md) bazaar, decode `402 Payment Required`
challenges, and pay per call for paid APIs and MCP tools in **USDC or $THREE on
Solana**, or **USDC on Base** and other EVM chains, without leaving your editor.
Powered by [three.ws](https://three.ws).

x402 is a protocol for developers and agents, not end users, so unlike a 3D
viewer this is genuinely editor-native: the people wiring up paid endpoints and
calling them live in VS Code.

## Pay with $THREE on Solana

Set `threewsX402.preferToken` to `three` to prefer endpoints that accept the
three.ws ecosystem token.

- **Symbol:** `$THREE`
- **Network:** Solana
- **Contract address:** `FeMbDoX7R1Psc4GEcvJdsbNbZA3bfztcyDCatJVJpump`
- **Payment scheme:** x402 `exact` through `@x402/svm`

The extension only selects $THREE when the endpoint advertises that exact mint
in its 402 challenge. It shows the amount, network, paying address, and
recipient, then requires explicit confirmation before signing. Read the full
[x402 for VS Code guide](https://three.ws/docs/x402-vscode).

## Features

- **Bazaar sidebar** — live list of paid x402 HTTP APIs and MCP tools, merged
  across every facilitator via the three.ws discovery proxy
  (`/api/bazaar/list`, `/api/bazaar/search`). Filter by type, price, and tag;
  full-text search.
- **Inspect an endpoint** — paste any URL and decode its 402 challenge: every
  accepted network, asset, scheme, price (in USD), and `payTo`, with the rail
  each accept settles on (`[solana]` / `[evm]`) and the one this wallet can
  satisfy flagged.
- **Pay & call** — make a real paid request and settle it on the right rail
  automatically: **USDC or $THREE on Solana** via the real `@x402/svm` `exact`
  scheme, or **USDC on Base** and other EVM chains via
  [`@three-ws/x402-fetch`](../x402-fetch). The exact USD amount, token, and
  network are shown and confirmed before signing; a spending cap blocks anything
  above your limit. The response body and on-chain settlement receipt (tx hash)
  render inline.
- **Two secure wallets** — an EVM key and a Solana key, each stored only in VS
  Code SecretStorage (the OS keychain). Never in settings, never on disk in
  plaintext. The status bar shows both derived addresses.
- **Scaffold a paid endpoint** — generate a working `api/x402/<slug>.js` that
  follows the repo's canonical `paidEndpoint()` pattern, wired end-to-end from
  the first deploy.

## Setup

1. Install the extension and open the **x402 Bazaar** view in the activity bar.
2. Set a wallet key for the rail you want to pay on:
   - **x402: Set Solana Wallet Key** — a base58 secret key (or JSON byte array)
     for a funded Solana wallet holding USDC and/or $THREE.
   - **x402: Set EVM Wallet Key** — a `0x` + 64 hex key for a funded Base USDC
     wallet.
   Either or both; keys are stored in your OS keychain.
3. Browse or search the bazaar, open a service, and **Pay & call**.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `threewsX402.origin` | `https://three.ws` | Host of the bazaar discovery API. |
| `threewsX402.maxPaymentUsd` | `0.10` | Per-request spending cap, in USD. |
| `threewsX402.confirmEachPayment` | `true` | Confirm the exact amount before signing. |
| `threewsX402.network` | `""` (auto) | Preferred CAIP-2 network when a service accepts several (`solana:…` or `eip155:…`). Auto prefers USDC on Solana, then Base. |
| `threewsX402.preferToken` | `auto` | Token to pay when several are offered: `auto` (USDC first, then $THREE), `usdc`, or `three`. |
| `threewsX402.filters` | `{ "type": "http" }` | Default bazaar filters. |

The USD spending cap applies to USDC payments. A non-stable token such as
`$THREE` is always shown in token units and always requires explicit
confirmation because the 402 challenge does not provide a fiat conversion.

## How payment works

The extension reads the 402 challenge and picks a payable requirement across both
rails, honouring `network` and `preferToken`.

- **Solana** (`solana:*`): the real `@x402/svm` `exact` scheme signs an SPL
  transfer of the selected token (USDC or **$THREE**, mint
  `FeMbDoX7R1Psc4GEcvJdsbNbZA3bfztcyDCatJVJpump`) from your key and retries with
  the `X-PAYMENT` proof. This is the same buyer `@three-ws/x402-mcp` uses.
- **EVM** (`eip155:*`): [`@three-ws/x402-fetch`](../x402-fetch) signs a USDC
  **EIP-3009** `transferWithAuthorization` on Base (or another EVM chain) and
  retries with the proof.

Either way the merchant settles on-chain and returns the work plus a settlement
receipt, rendered inline with the token, network, and transaction hash. A
service that only accepts a rail you have no key for is flagged, and the
extension offers to set the matching wallet.

## Development

```bash
npm install
npm run build        # bundle to dist/extension.cjs
npm run watch        # rebuild on change
npm test             # requirement selection, token rules, scaffold template
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host.

Apache-2.0 (see [LICENSE](./LICENSE)) · part of the
[three.ws](https://three.ws) monorepo.

<!-- three.ws:growth -->
## Support the project

If vscode-x402 saves you time, **[star it on GitHub](https://github.com/nirholas/vscode-x402)**. Stars are how other developers and AI agents find the repositories worth trusting, and they cost you one click.

Know someone who would use it? [Post on X](https://twitter.com/intent/tweet?text=vscode-x402%3A%20Browse%20the%20x402%20bazaar%2C%20decode%20402%20payment%20challenges%2C%20and%20pay%20per%20call%20for%20paid%20APIs%20and%20MCP%20tools&url=https%3A%2F%2Fgithub.com%2Fnirholas%2Fvscode-x402) · [Share on Bluesky](https://bsky.app/intent/compose?text=vscode-x402%3A%20Browse%20the%20x402%20bazaar%2C%20decode%20402%20payment%20challenges%2C%20and%20pay%20per%20call%20for%20paid%20APIs%20and%20MCP%20tools%20https%3A%2F%2Fgithub.com%2Fnirholas%2Fvscode-x402) · [Share on LinkedIn](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fgithub.com%2Fnirholas%2Fvscode-x402) · [Submit to Hacker News](https://news.ycombinator.com/submitlink?u=https%3A%2F%2Fgithub.com%2Fnirholas%2Fvscode-x402&t=vscode-x402%3A%20Browse%20the%20x402%20bazaar%2C%20decode%20402%20payment%20challenges%2C%20and%20pay%20per%20call%20for%20paid%20APIs%20and%20MCP%20tools) · [Share on Reddit](https://www.reddit.com/submit?url=https%3A%2F%2Fgithub.com%2Fnirholas%2Fvscode-x402&title=vscode-x402%3A%20Browse%20the%20x402%20bazaar%2C%20decode%20402%20payment%20challenges%2C%20and%20pay%20per%20call%20for%20paid%20APIs%20and%20MCP%20tools)

## Built for AI agents too

Coding agents and LLM tooling can read this repo directly: [AGENTS.md](./AGENTS.md), [llms.txt](./llms.txt), [llms-full.txt](./llms-full.txt). Point an agent at `https://github.com/nirholas/vscode-x402` and it has the context it needs.

## More from the same author

- [All repositories by nirholas](https://github.com/nirholas/nirholas#readme): the full catalog, grouped by topic
- [three.ws](https://three.ws): the platform for 3D AI agents with Solana wallets, a skill marketplace and x402 payments
- Questions or ideas: [open an issue](https://github.com/nirholas/vscode-x402/issues) or [start a discussion](https://github.com/nirholas/vscode-x402/discussions)

## Contributors

[![Contributors](https://contrib.rocks/image?repo=nirholas/vscode-x402)](https://github.com/nirholas/vscode-x402/graphs/contributors)

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=nirholas/vscode-x402&type=Date)](https://www.star-history.com/#nirholas/vscode-x402&Date)

<!-- /three.ws:growth -->

<!-- three.ws:ecosystem -->
## Part of three.ws

[three.ws](https://three.ws) is a platform for 3D AI agents with Solana wallets: avatars, a skill marketplace, x402 payments and more than seventy MCP servers. `@three-ws/vscode-x402` is one package from it.

- Documentation site: https://nirholas.github.io/vscode-x402/
- npm: https://www.npmjs.com/package/@three-ws/vscode-x402
- Canonical source: https://github.com/nirholas/three.ws (this repository is a generated mirror of `packages/vscode-x402`)
- Agent-readable summary: [llms.txt](./llms.txt) and [AGENTS.md](./AGENTS.md)
- Issues and ideas: https://github.com/nirholas/vscode-x402/issues
<!-- /three.ws:ecosystem -->
