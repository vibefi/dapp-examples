# VibeFi Constraints
VibeFi enforces the following constraints on all dapps.

### Why?
In order to ensure safe, reproducible builds for all dapps, VibeFi compiles everything locally. Only uncompiled components and assets are published and fetched via VibeFi making all dapps on VibeFi easily auditable by humans and agents alike.

## Packages
 - react@19.2.4
 - react-dom@19.2.4
 - typescript@5.9.3
 - vite@7.2.4
 - @tanstack/react-query@5.90.20
 - wagmi@3.4.1
 - viem@2.45.0
 - shadcn@3.7.0
 - @types/react@19.2.4

If you would like a new package to be added to this list, you can open a [client proposal](TODO: insert link).

## Files
- src/ (.ts and .tsx only) 
- assets/ (.webp only) 
- abis/ (.json only) 
- index.html
- addresses.json (deployed addresses needed for protocol) 
- manifest.json

### Developing
To get started we recommend you use `TODO: insert cli command` to scaffold your project. This will contain more files than the constrained files so that you can actually locally run and test your dapp. When packaging and publishing on VibeFi, these files will be ignored.

In order to help with vibe-coding, we have a [prompt.md](./prompt.md) which you can use to get your agent going in the right direction.

### Addresses

TODO: schema for addresses.json

### Manifest

TODO: schema for manifest.json

## Resources
- Injected Wallet (`window.ethereum`)
- Injected RPC_URLs (TODO: maybe we don't need this? could we do all calls via injected wallet?)
