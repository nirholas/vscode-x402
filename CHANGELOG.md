# Changelog

## 0.1.0

Initial release.

- Inspect command: paste any endpoint URL and decode its 402 payment challenge —
  no configuration required.
- Pay & call paid x402 endpoints with USDC, with a spending cap, pre-payment
  confirmation, and inline settlement receipts. The payment client is vendored
  and zero-dependency (`src/vendor/x402-fetch.js`).
- Optional bazaar sidebar: set `x402.bazaarUrl` to a discovery host to list,
  filter, and search services. Ships with no default host.
- Secure EVM wallet key storage in VS Code SecretStorage; wallet status bar.
- Scaffold a self-contained paid endpoint that returns a 402 challenge and runs
  your work only after payment verifies.
