# x402 — Pay-per-call APIs for VS Code

> Browse an [x402](https://github.com/coinbase/x402) bazaar, decode `402 Payment Required` challenges, and pay-per-call paid APIs and MCP tools with USDC — without leaving your editor.

[![VS Code Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/nirholas.vscode-x402?label=Marketplace&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=nirholas.vscode-x402)
[![VS Code Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/nirholas.vscode-x402?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=nirholas.vscode-x402)
[![License: Proprietary](https://img.shields.io/badge/license-Proprietary-red.svg)](./LICENSE)

---

## What is this?

**x402** is a payment protocol for developers and agents. A server answers a
request with `402 Payment Required` and a machine-readable challenge; the caller
signs a USDC authorization and retries the same request with proof of payment;
the server does the work and returns a settlement receipt. No accounts, no API
keys, no subscriptions — just per-call settlement on-chain.

This extension brings that whole loop into VS Code, where the people wiring up
and calling paid endpoints actually work. Paste a URL and **see what it costs**.
Click **Pay & call** and get the response plus the on-chain receipt inline.
Browse a marketplace of paid APIs and MCP tools in the sidebar. Scaffold your own
paid endpoint in one command.

It has **no dependency on any specific provider.** Point it at any compliant
x402 endpoint, or at any bazaar that serves the discovery API. Discovery is
optional — inspecting and paying a single endpoint URL needs zero configuration.

## Features

- **Inspect any endpoint** — paste a URL and decode its 402 challenge: every
  accepted network, asset, payment scheme, price (converted to USD), and `payTo`
  address, with the one requirement *your* wallet can satisfy flagged. Read-only,
  no signing, no configuration.
- **Pay & call** — make a real paid request from a panel. The exact USD amount is
  shown and confirmed before any key touches the request; a per-call spending cap
  blocks anything above your limit. The response body and on-chain settlement
  receipt (transaction hash) render inline.
- **Bazaar sidebar** — set a discovery host and the **x402 Bazaar** view lists
  paid HTTP APIs and MCP tools. Filter by type, max price, and tag; full-text
  search; click any service to open its detail panel and pay.
- **Secure wallet** — your EVM private key lives only in VS Code SecretStorage
  (the OS keychain), never in `settings.json` and never on disk in plaintext. A
  status-bar item shows the derived address.
- **Scaffold a paid endpoint** — generate a self-contained, framework-agnostic
  Node handler that answers an unpaid request with a 402 challenge and runs your
  work only after payment verifies.

## Install

**From the Marketplace** — open the Extensions view (<kbd>Ctrl/Cmd</kbd> +
<kbd>Shift</kbd> + <kbd>X</kbd>), search for **x402**, and install
`nirholas.vscode-x402`. Or run from the Command Palette:

```
ext install nirholas.vscode-x402
```

**From a `.vsix`** — download a release `.vsix` (or build one with
`npx @vscode/vsce package`) and install it:

```bash
code --install-extension vscode-x402-0.1.0.vsix
```

Or in the editor: Extensions view → `…` menu → **Install from VSIX…**.

After install, the **x402 Bazaar** icon appears in the activity bar.

## Commands reference

Every command is available from the Command Palette (<kbd>Ctrl/Cmd</kbd> +
<kbd>Shift</kbd> + <kbd>P</kbd>), prefixed with `x402:`. Bazaar-scoped commands
also appear as icons on the sidebar title bar and in the service context menu.

| Command Title | Command ID | What it does |
|---|---|---|
| x402: Inspect Endpoint (decode 402 challenge) | `x402.inspect` | Prompts for a URL, does an unpaid request, and writes the decoded 402 challenge (networks, assets, prices in USD, `payTo`) to the **x402** output channel. No wallet, no host, no signing. |
| x402: Pay & Call Endpoint | `x402.pay` | Prompts for a URL (or acts on the selected bazaar service) and opens the service detail panel where you set the method/body and pay. |
| x402: Open Service Details | `x402.openService` | Opens the detail webview for a bazaar service. Fired automatically when you click a service in the sidebar. |
| x402: Scaffold a Paid Endpoint | `x402.scaffoldEndpoint` | Generates `api/x402/<slug>.js` in the open workspace — a standalone Node handler that returns a 402 challenge and runs your work only after payment verifies. |
| x402: Set Wallet Key | `x402.setWalletKey` | Prompts for an EVM private key (`0x` + 64 hex), validates that it derives an address, and stores it in the OS keychain (SecretStorage). |
| x402: Clear Wallet Key | `x402.clearWalletKey` | Deletes the stored wallet key from SecretStorage. |
| x402: Set Bazaar Discovery Host | `x402.setBazaarUrl` | Prompts for the origin that serves the bazaar discovery API and saves it to `x402.bazaarUrl`. Leave blank to disable discovery. |
| x402: Refresh Bazaar | `x402.refresh` | Re-fetches the service list from the configured bazaar host. |
| x402: Search Bazaar | `x402.search` | Prompts for keywords and full-text searches the bazaar (empty query lists everything). |
| x402: Set Bazaar Filters | `x402.setFilters` | Sets the default bazaar filters — type (`http` / `mcp`), max price (USDC atomics), and tag — and refreshes. |

## Settings reference

Configure these under **Settings → Extensions → x402**, or edit `settings.json`
directly. Every payment-related setting works whether or not a bazaar host is
configured.

| Setting | Type | Default | Description |
|---|---|---|---|
| `x402.bazaarUrl` | `string` | `""` | Origin that hosts the bazaar discovery API (serves `/api/bazaar/list` and `/api/bazaar/search`). **Optional** — leave blank to disable discovery. Inspecting or paying a specific endpoint URL needs no host. |
| `x402.maxPaymentUsd` | `number` | `0.1` | Spending cap per request, in USD. Any payment above this is refused before signing (you're prompted to raise the cap for that call). |
| `x402.confirmEachPayment` | `boolean` | `true` | Show a modal confirmation with the exact USD amount before signing each payment. |
| `x402.network` | `string` | `"eip155:8453"` | Preferred CAIP-2 network when an endpoint accepts several. Default is Base mainnet. |
| `x402.filters` | `object` | `{ "type": "http" }` | Default bazaar filters. Supported keys: `type` (`http` / `mcp`), `network`, `maxPrice` (USDC atomics), `asset`, `extension`, `tag`, `sort`. |

## Usage

### a. Inspect any x402 URL

No bazaar, no wallet, no account — this is read-only.

1. Run **x402: Inspect Endpoint (decode 402 challenge)** from the Command Palette.
2. Paste the endpoint URL, e.g. `https://your-api.example.com/x402/summarize`.
3. The **x402** output channel opens and prints the decoded challenge — one line
   per accepted requirement showing network, scheme, USD price, and asset, with
   `← payable by this wallet` flagging the one your configured network/asset can
   satisfy. If nothing is payable (e.g. a Solana-only service), it says so.

### b. Pay an endpoint

1. Run **x402: Set Wallet Key** once and paste a funded EVM private key
   (`0x` + 64 hex). It is stored in the OS keychain — see [Security](#security).
   The status bar shows the derived address.
2. Run **x402: Pay & Call Endpoint**, paste the URL (or click a service in the
   bazaar sidebar). The service detail panel opens.
3. Choose the method (`GET`/`POST`) and, for POST or MCP calls, edit the JSON
   request body. Click **Pay & call**.
4. The extension pre-checks the 402 to learn the real price, then shows a modal:
   *"Pay $X from 0xabc…1234 to call …?"* (controlled by
   `x402.confirmEachPayment`). If the price is above `x402.maxPaymentUsd`, you're
   asked to **Raise cap & pay** instead.
5. On confirm, it signs a USDC EIP-3009 authorization, retries with the
   `X-PAYMENT` proof, and renders the response body plus the settlement receipt
   (status, amount paid, paying address, and transaction hash) in the panel.

### c. Browse a bazaar

1. Run **x402: Set Bazaar Discovery Host** and enter an origin that serves
   `/api/bazaar/list` and `/api/bazaar/search` (this writes `x402.bazaarUrl`).
2. The **x402 Bazaar** sidebar lists services — each row shows the price, type,
   and networks. Hover for a full Markdown tooltip.
3. Use the title-bar icons: **Search** (full-text), **Set Filters** (type / max
   price / tag), and **Refresh**.
4. Click any service to open its detail panel, then pay as in (b). The inline
   **Pay** action on a service row jumps straight there.

### d. Scaffold a paid endpoint

1. Open a workspace folder.
2. Run **x402: Scaffold a Paid Endpoint**.
3. Enter a slug (e.g. `summarize`), a price per call in USD (e.g. `0.01`), and a
   description shown in the 402 challenge.
4. The extension writes `api/x402/<slug>.js` and opens it. It's a standalone Node
   handler: an unpaid request gets a `402` challenge; once an `X-PAYMENT` header
   verifies through your facilitator, `run()` executes.
5. Set `X402_RESOURCE_URL`, `X402_PAY_TO`, and `X402_FACILITATOR_VERIFY_URL`
   (env), then replace the `run()` echo with your real service logic.

A full walkthrough of each flow lives in [docs/usage.md](docs/usage.md).

## How payment works

The payment client is **vendored and zero-dependency** —
[`src/vendor/x402-fetch.js`](src/vendor/x402-fetch.js) — so the extension pulls
in no payment SDK at runtime. It:

1. Sends your request unpaid. If the server answers anything but `402`, that
   response is returned as-is (free endpoints just work).
2. Parses the 402 challenge and selects the requirement matching your preferred
   network (`x402.network`) and a USDC EIP-3009 asset your EVM key can sign.
3. Signs a USDC-on-Base **`transferWithAuthorization`** (EIP-3009 / EIP-712) and
   retries the request with the `X-PAYMENT` header.
4. The merchant settles on-chain and returns the work plus a settlement receipt,
   which the panel decodes from the `x-payment-response` header.

The secp256k1 / keccak256 / EIP-712 stack is pure JavaScript and depends only on
**Web Crypto** (`crypto.subtle`), present in Node ≥ 18 and modern browsers.
Solana-only services appear in the bazaar but are flagged as not payable by this
EVM signer.

## Security

- **The private key lives only in VS Code SecretStorage** (your OS keychain — 
  Keychain on macOS, Credential Manager on Windows, libsecret on Linux). It is
  never written to `settings.json`, never logged, never persisted to disk in
  plaintext. Run **x402: Clear Wallet Key** to remove it.
- **Spending cap.** `x402.maxPaymentUsd` (default `$0.10`) is checked before
  signing; anything above it requires explicit consent for that call.
- **Per-payment confirmation.** With `x402.confirmEachPayment` on (default), a
  modal shows the exact amount and paying address before any signature.
- **Use a dedicated, low-balance wallet** funded only with what you intend to
  spend on calls. Treat it like petty cash, not a vault.

## Requirements

- **VS Code** `^1.85.0` or newer.
- **A funded EVM wallet** (USDC on Base mainnet by default) to pay endpoints.
  Inspecting and browsing need no wallet.
- **Node.js ≥ 18** to *run* a scaffolded endpoint (it relies on global `fetch`
  and Web Crypto). The extension itself bundles everything it needs.
- **A bazaar discovery host** only if you want the sidebar marketplace; inspect
  and pay work against any bare URL without one.

## Troubleshooting / FAQ

**"No bazaar discovery host is set."**
You opened the sidebar without configuring `x402.bazaarUrl`. That's expected —
the extension ships pointing nowhere. Run **x402: Set Bazaar Discovery Host**, or
skip it entirely and use **Inspect** / **Pay & Call** with a bare URL.

**"This endpoint requires payment but offers no requirement this wallet can satisfy."**
The 402 challenge has no USDC EIP-3009 accept on an EVM network this signer
supports (often a Solana-only service). The EVM signer can't pay it; use a wallet
and network the endpoint accepts.

**"Expected a 0x-prefixed 32-byte (64 hex char) EVM private key."**
The key must be exactly `0x` followed by 64 hexadecimal characters. Export it in
that raw hex form, not as a seed phrase or keystore JSON.

**A call costs more than my cap.**
`x402.maxPaymentUsd` blocked it. The extension prompts **Raise cap & pay** for
that single call, or raise the default in settings.

**The payment went through but I got a 402 back.**
The merchant didn't accept the settlement — usually a price or recipient
mismatch, or the facilitator rejected the proof. Re-inspect the endpoint to
confirm the current price and `payTo`, and that your wallet has enough USDC.

**Where do I get a bazaar host / how do I publish a service to one?**
Discovery is an open API contract (`/api/bazaar/list`, `/api/bazaar/search`).
Point `x402.bazaarUrl` at any host that implements it. To *publish* a paid
service, scaffold an endpoint (above) and register its resource URL with your
bazaar of choice.

**Does this lock me into a provider?**
No. The extension speaks the open x402 protocol against any compliant endpoint
or bazaar. The payment client is vendored, with no third-party SDK at runtime.

## Development

```bash
npm install
npm run build        # bundle to dist/extension.js
npm run watch        # rebuild on change
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host with the
extension loaded. See [CONTRIBUTING.md](CONTRIBUTING.md) for the layout and how
to package a `.vsix`.

## Related packages

- [`@nirholas/x402-fetch`](https://www.npmjs.com/package/@nirholas/x402-fetch) —
  the standalone, zero-dependency `fetch` wrapper this extension vendors.
- [x402 protocol](https://github.com/coinbase/x402) — the open spec for
  HTTP `402`-based pay-per-call.

## License

Proprietary — Copyright (c) 2026 nirholas. All Rights Reserved. Unauthorized use, copying, modification, or distribution is prohibited. See [LICENSE](./LICENSE).
