Given you have a package.json with react@19.2.4, react-dom@19.2.4, typescript@5.9.3, wagmi@3.4.1, @tanstack/react-query@5.90.20, viem@2.45.0, shadcn@3.7.0, vite@7.2.4. You cannot use any other libraries, if you need one and cannot easily code around it, stop and ask for it. You have an `RPC_URL` variable available in your environment which contains a working Ethereum RPC endpoint. You have `window.ethereum` which is the users connected wallet. You cannot make arbitrary HTTP calls, only RPC calls. If IPFS reads are needed, use injected `window.vibefiIpfs` with permissions declared in `manifest.json`.

Deliver a bundle containing: 
- src/ (ts and tsx only) 
- assets/ (webp only) 
- abis/ (json only) 
- addresses.json (deployed addresses needed for protocol) 
- manifest.json (including capabilities if IPFS access is needed)
- package.json (containing only the libraries mentioned)
- index.html
- tsconfig.json

Security rules:
1. Never use execution sinks for untrusted data (`eval`, `new Function`, dynamic `import`, script injection, worker/iframe srcdoc payloads).
2. For IPFS snippets/text, render with text nodes only (`textContent`), never `innerHTML`/`dangerouslySetInnerHTML`.

If you need any clarifications, stop and ask before developing. 

> Insert User Prompt: e.g. Create an app to interact with UniswapV2 on Ethereum mainnet.

Check existing onchain interactions for this protocol to learn how to interact with it.
