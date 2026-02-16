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
- src/ (.ts, .tsx, and .css only) 
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

`manifest.json` is part of the source bundle contract and must include a
`capabilities` section when your vapp needs extra injected runtime capabilities.

Current capability surface:
```json
{
  "capabilities": {
    "ipfs": {
      "allow": [
        {
          "cid": "bafy...",
          "paths": ["metadata/**"],
          "as": ["json", "text", "snippet", "image"],
          "maxBytes": 262144
        }
      ]
    }
  }
}
```

Notes:
1. `cid` is optional. If omitted, the path rule applies to any CID.
2. `paths` are allowlist path patterns (no URL/scheme inputs).
3. `as` is behavior-scoped and must only use: `json`, `text`, `snippet`, `image`.
4. `maxBytes` is optional and sets an upper bound for reads under that rule.
5. Runtime permission checks are host-enforced. Review rules are defense-in-depth only.

## Resources
- Injected Wallet (`window.ethereum`)
- Injected RPC_URLs (TODO: maybe we don't need this? could we do all calls via injected wallet?)
- Injected IPFS data API (`window.vibefiIpfs`) behind manifest capabilities

## Security Requirements for IPFS Data
1. IPFS-derived content is untrusted data, never executable code.
2. Do not pass IPFS payloads to execution sinks (`eval`, `new Function`, dynamic `import`, script-tag injection, worker/iframe srcdoc).
3. Snippets/text from IPFS must be rendered as text nodes (`textContent`), never with `innerHTML`/`dangerouslySetInnerHTML`.
