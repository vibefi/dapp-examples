# VibeFi Dapp Examples ("vapps")

Fully client-side reference apps that showcase how to ship VibeFi "vapps" under the [constraints](./constraints.md) while following the authoring [prompt](./prompt.md).  

Examples in this repo are fully client-side and include both Vite + React projects and one static-html project (`zfi/` as a git submodule). All apps talk directly to Ethereum via JSON-RPC reads and `window.ethereum` writes; no server code is included.

## Constraints
- Allowed runtime/dev dependencies are pinned; add-ons require a governance proposal before inclusion.
- Only ship `src/**/*.ts|tsx|css`, `assets/**/*.webp`, `abis/**/*.json`, `vibefi.json`, and `index.html`; build artifacts and extra tooling stay local.
- All apps must rely on the injected `RPC_URL` (or `VITE_RPC_URL`) plus `window.ethereum`; arbitrary fetches are disallowed.
- If your app needs IPFS reads, use injected `window.vibefiIpfs` and declare permissions in `vibefi.json` capabilities.
- IPFS payloads are data-only and must never be sent to execution sinks.

## Local Dev Workflow
From each example folder, install deps and start Vite, e.g.:

```
cd aave-v3
bun install
RPC_URL="https://mainnet.infura.io/v3/…" bun vite dev
```

## Nested submodules

- `zfi/` is a nested git submodule pointing to `https://github.com/devanoneth/zFi.git`.
- Initialize or resync nested submodules from this repository with:

```
git submodule sync --recursive
git submodule update --init --recursive
```

## Publishing
TODO: Section on publishing using `cli` and/or `studio`.
