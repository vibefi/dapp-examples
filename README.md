# VibeFi Dapp Examples ("vapps")

Fully client-side reference apps that showcase how to ship VibeFi "vapps" under the [constraints](./constraints.md) while following the authoring [prompt](./prompt.md).  

Every example is a Vite + React 19 project that talks directly to Ethereum mainnet via JSON-RPC reads and `window.ethereum` writes; no server code or additional packages are included beyond the approved list.

## Constraints
- Allowed runtime/dev dependencies are pinned; add-ons require a governance proposal before inclusion.
- Only ship `src/**/*.ts|tsx`, `assets/**/*.webp`, `abis/**/*.json`, `addresses.json`, `manifest.json`, and `index.html`; build artifacts and extra tooling stay local.
- All apps must rely on the injected `RPC_URL` (or `VITE_RPC_URL`) plus `window.ethereum`; arbitrary fetches are disallowed.
- If your app needs IPFS reads, use injected `window.vibefiIpfs` and declare permissions in `manifest.json` capabilities.
- IPFS payloads are data-only and must never be sent to execution sinks.

## Local Dev Workflow
From each example folder, install deps and start Vite, e.g.:

```
cd aave-v3
bun install
RPC_URL="https://mainnet.infura.io/v3/…" bun vite dev
```

## Publishing
TODO: Section on publishing using `cli` and/or `studio`.
