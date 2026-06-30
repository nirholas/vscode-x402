# Changelog

All notable changes to the **x402 — Pay-per-call APIs** extension are documented
here. This project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0]

Initial release.

### Added

- **Inspect Endpoint** command — paste any URL and decode its `402` payment
  challenge (accepted networks, assets, schemes, prices in USD, and `payTo`) in
  the **x402** output channel. No wallet, no host, no signing required.
- **Pay & Call** flow — pay any x402 endpoint with USDC from a service detail
  panel. The exact USD amount is pre-checked and confirmed before signing; a
  per-call spending cap (`x402.maxPaymentUsd`) blocks anything above your limit;
  the response body and on-chain settlement receipt (transaction hash) render
  inline. The payment client is vendored and zero-dependency
  (`src/vendor/x402-fetch.js`, Web Crypto only).
- **Bazaar sidebar** — an optional marketplace view that lists paid HTTP APIs and
  MCP tools from a discovery host. Set `x402.bazaarUrl` to enable it; filter by
  type, max price, and tag; full-text search. Ships with no default host.
- **Secure wallet** — EVM private key stored only in VS Code SecretStorage (the
  OS keychain), with a status-bar item showing the derived address, and **Set** /
  **Clear Wallet Key** commands.
- **Scaffold a Paid Endpoint** command — generate a self-contained, framework-
  agnostic Node handler that answers an unpaid request with a 402 challenge and
  runs your work only after payment verifies.

[0.1.0]: https://github.com/nirholas/vscode-x402/releases/tag/v0.1.0
