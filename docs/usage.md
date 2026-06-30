# Usage walkthroughs

In-depth, step-by-step guides for every flow in the **x402 — Pay-per-call APIs**
extension. For the quick version and the full commands/settings tables, see the
[README](../README.md). Throughout, *"run a command"* means open the Command
Palette (<kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>) and type the
command title.

---

## 1. Inspect any x402 URL

The fastest way to understand a paid endpoint — read-only, no wallet, no host,
no signing.

1. Run **x402: Inspect Endpoint (decode 402 challenge)**.
2. When prompted, paste the endpoint URL, e.g.:

   ```
   https://your-api.example.com/x402/summarize
   ```

3. The extension sends an unpaid `GET` and reads the response:
   - If the status is **not** `402`, it reports that no payment is required (a
     `2xx`) or that the endpoint didn't issue a challenge.
   - If the status is `402`, it parses the challenge and writes one line per
     accepted requirement to the **x402** output channel:

     ```
     Status: 402 Payment Required

     #1 eip155:8453 · exact · $0.010000 0x8335…2913 ← payable by this wallet
          payTo: 0xMerchantReceivingAddress…
     ```

   - The `← payable by this wallet` marker flags the requirement that matches your
     preferred network (`x402.network`) and a USDC EIP-3009 asset your EVM key can
     sign. If none match, a warning explains that no requirement is satisfiable
     (for example, a Solana-only service).

No private key is read and no request is signed during inspection.

---

## 2. Pay an endpoint

### One-time: set a wallet key

1. Run **x402: Set Wallet Key**.
2. Paste an EVM private key in raw hex form — `0x` followed by exactly 64
   hexadecimal characters. The input is masked.
3. The extension validates that the key derives a real address, then stores it in
   VS Code SecretStorage (your OS keychain). The status bar updates to
   `x402 0xabc…1234`.

Run **x402: Clear Wallet Key** at any time to remove it.

> **Funding:** by default the wallet pays USDC on **Base mainnet**. Fund the
> address shown in the status bar with USDC (and a little ETH for gas, if your
> facilitator requires it) before paying.

### Pay & call

1. Run **x402: Pay & Call Endpoint** and paste the endpoint URL (or click a
   service in the bazaar sidebar — see [§3](#3-browse-a-bazaar)). The **service
   detail panel** opens.
2. In the panel:
   - Choose the **Method** (`GET` or `POST`).
   - For `POST` or MCP calls, edit the **Request body** (JSON). MCP services are
     pre-filled with a `tools/call` JSON-RPC envelope.
   - Click **Pay & call**.
3. The extension pre-checks the 402 to read the live price and then:
   - If the endpoint isn't actually paid (no `402`), it just runs the request —
     no signing — and shows the response as "free".
   - If the price exceeds `x402.maxPaymentUsd`, it prompts **Raise cap & pay**.
   - Otherwise, with `x402.confirmEachPayment` on (default), it shows a modal:

     > Pay $0.010000 from 0xabc…1234 to call summarize?

4. On confirmation, it signs a USDC EIP-3009 `transferWithAuthorization`, retries
   the request with the `X-PAYMENT` header, and renders in the panel:
   - **Status**, **Paid** (USD), and the **From** address.
   - The **Tx** hash and network from the settlement receipt, when present.
   - The full response body (pretty-printed if JSON).
   - A notification with the status and short tx hash also appears.

### Spend controls

- **`x402.maxPaymentUsd`** (default `$0.10`) — the hard per-call ceiling. Nothing
  above it is signed without an explicit *Raise cap & pay*.
- **`x402.confirmEachPayment`** (default `true`) — set `false` to skip the
  per-call modal (the cap still applies).
- **`x402.network`** (default `eip155:8453`) — which CAIP-2 network to prefer when
  an endpoint accepts several.

---

## 3. Browse a bazaar

A bazaar is any host that serves the discovery API (`/api/bazaar/list` and
`/api/bazaar/search`). Discovery is opt-in; the extension ships with no default.

1. Run **x402: Set Bazaar Discovery Host** and enter the origin, e.g.
   `https://your-bazaar.example.com`. This saves `x402.bazaarUrl`. (Leave it
   blank to disable discovery again.)
2. Open the **x402 Bazaar** view from the activity bar. The sidebar lists
   services, each showing `price · type · networks`. Hover a row for a Markdown
   tooltip with the resource URL, price, networks, facilitator, and tags.
3. Use the title-bar actions:
   - **Search** (`x402.search`) — full-text query; an empty query lists
     everything.
   - **Set Filters** (`x402.setFilters`) — choose type (`http` / `mcp`), an
     optional max price (in USDC atomics), and an optional tag.
   - **Refresh** (`x402.refresh`) — re-fetch the list.
4. Click any service to open its detail panel, or use the inline **Pay** action on
   a service row. From there, pay exactly as in [§2](#2-pay-an-endpoint).

If the discovery host is unreachable or returns an error, the sidebar shows the
error inline rather than failing silently.

---

## 4. Scaffold a paid endpoint

Generate a standalone, framework-agnostic paid endpoint you can drop into any
Node server.

1. Open a workspace folder (the file is written into it).
2. Run **x402: Scaffold a Paid Endpoint**.
3. Answer the prompts:
   - **Slug** — lowercase letters, digits, and hyphens, e.g. `summarize`. The
     file lands at `api/x402/summarize.js`.
   - **Price per call (USD)** — a positive number, e.g. `0.01`. Converted to USDC
     atomics (6 decimals) in the challenge.
   - **Description** — shown to buyers in the 402 challenge.
4. The file opens. It is a self-contained handler that:
   - Returns a `402` challenge (with your price, `payTo`, and USDC-on-Base accept)
     when there's no `X-PAYMENT` header.
   - Verifies the buyer's payment proof through a facilitator, then runs `run()`
     and returns the result.
5. Wire it up:
   - Set `X402_RESOURCE_URL` to the public URL the endpoint is served from.
   - Set `X402_PAY_TO` to your receiving wallet address.
   - Set `X402_FACILITATOR_VERIFY_URL` to a facilitator `/verify` endpoint.
   - Replace the echo in `run(body)` with your real service logic.
6. Adapt the generic `(req, res)` handler to your runtime (Express, Vercel,
   Cloudflare Workers, etc.) — the request/response shims are intentionally
   minimal.

Test it end-to-end from this same extension: run **x402: Inspect Endpoint**
against its URL to confirm the challenge, then **x402: Pay & Call Endpoint** to
pay it.

---

## Where things are stored

| Thing | Location |
|---|---|
| Wallet private key | VS Code SecretStorage (OS keychain) — never on disk in plaintext |
| Bazaar host, caps, network, filters | VS Code settings (`x402.*`) |
| Scaffolded endpoint | `api/x402/<slug>.js` in your workspace |
| Inspect output | The **x402** output channel |
