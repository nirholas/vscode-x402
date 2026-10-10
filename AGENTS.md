# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

`@three-ws/vscode-x402` v0.2.2. Browse the x402 bazaar, decode 402 payment challenges, and pay per call for paid APIs and MCP tools in USDC or $THREE on Solana and Base, without leaving VS Code. Powered by three.ws.

A JavaScript library. Import it from ESM.

## Use it

```bash
npm install @three-ws/vscode-x402
```

Full usage, tool list and configuration are in [README.md](README.md). Machine-readable summaries: [llms.txt](llms.txt) and [llms-full.txt](llms-full.txt).

## Develop

```bash
npm install
npm test
```

Scripts:
- `npm run build`: `node build.mjs`
- `npm run test`: `node --test "test/*.test.mjs"`
- `npm run watch`: `node build.mjs --watch`
- `npm run vscode:prepublish`: `node build.mjs --production`

## Conventions

- ES modules, Node >=20.
- Read-only by default. Anything that signs, spends or sends must be an explicit, separately named tool or option, and must never be inferred from untrusted text (token names, memos, listings).
- Never commit credentials. Configuration comes from environment variables documented in the README.
- Keep changes small and covered by a test next to the code they change.

## Source of truth

This repository is a generated mirror of `packages` in https://github.com/nirholas/three.ws. Open issues here; send substantial changes as a pull request here or upstream.
