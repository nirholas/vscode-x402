# Contributing to vscode-x402

Thanks for helping improve the x402 extension for VS Code. This guide covers the
project layout, the dev loop, and how to package a release.

## Prerequisites

- **Node.js ≥ 18** (the extension and its vendored payment client rely on global
  `fetch` and Web Crypto).
- **VS Code ≥ 1.85**.

## Getting started

```bash
git clone https://github.com/nirholas/vscode-x402.git
cd vscode-x402
npm install
npm run build        # bundle src → dist/extension.js
```

Press <kbd>F5</kbd> in VS Code to launch an **Extension Development Host** with
the extension loaded. Use `npm run watch` in a terminal for incremental rebuilds
while you iterate, then reload the dev host (<kbd>Ctrl/Cmd</kbd> + <kbd>R</kbd>).

## Project layout

```
src/
  extension.js        # entry point — registers commands, tree, status bar
  tree.js             # bazaar sidebar TreeDataProvider
  bazaar.js           # discovery client (/api/bazaar/list, /api/bazaar/search)
  inspect.js          # unpaid probe + 402 challenge → human summary
  pay.js              # pay-per-call flow (cap, confirm, sign, receipt)
  panel.js            # service detail webview
  scaffold.js         # "Scaffold a Paid Endpoint" generator
  wallet.js           # SecretStorage key handling + address derivation
  vendor/
    x402-fetch.js     # vendored, zero-dependency payment client (Web Crypto)
build.mjs             # esbuild bundler (vscode stays external)
media/                # activity-bar icon + extension icon
docs/usage.md         # in-depth walkthroughs
```

## Build

`build.mjs` bundles `src/extension.js` (and the vendored payment client) into a
single CommonJS file at `dist/extension.js`. The `vscode` module is provided by
the host and **must stay external** — never bundle or add it as a dependency.

```bash
npm run build                 # development bundle (with sourcemap)
node build.mjs --production   # minified, no sourcemap (used by vscode:prepublish)
npm run watch                 # rebuild on change
```

## Conventions

- **No runtime dependencies.** The payment primitives are vendored on purpose;
  keep it that way. Web Crypto (`crypto.subtle`) is the only crypto allowed.
- **The private key only ever lives in SecretStorage.** Never write it to
  settings, logs, the bundle, or disk.
- **No mocks, no fake data, no TODOs.** Every command must do real work against
  real endpoints. Inspect/pay must work against a bare URL with no bazaar host.
- **Document what you change.** New command or setting → update both tables in the
  [README](README.md). New flow → update [docs/usage.md](docs/usage.md). User-
  visible change → add a [CHANGELOG](CHANGELOG.md) entry.

## Packaging a release

```bash
npx @vscode/vsce package      # produces vscode-x402-<version>.vsix
```

Install the result locally to smoke-test:

```bash
code --install-extension vscode-x402-0.1.0.vsix
```

Publishing to the Marketplace (`vsce publish`) requires a publisher access token
for `nirholas` and is handled by the maintainer / the `publish` GitHub workflow.

## Submitting changes

1. Branch from `main`.
2. Make the change, run `npm run build`, and exercise it in the dev host.
3. Update the README / docs / changelog as applicable.
4. Open a PR describing what changed and how you tested it.

Proprietary — Copyright (c) 2026 nirholas. All Rights Reserved. By contributing you agree your work becomes part of this proprietary software, and that unauthorized use, copying, modification, or distribution is prohibited. See [LICENSE](./LICENSE).
