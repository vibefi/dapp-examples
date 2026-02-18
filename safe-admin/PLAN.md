# Vibefi Safe Admin Dapp (MVP) - Initial Spec

## 1. Goal
Build a new dapp example in `dapp-examples/safe-admin` that can administer and execute Safe transactions without relying on Safe backend services, using only wallet RPC plus on-chain reads/writes.

## 2. Inputs Used
- Vibefi client runtime constraints from:
  - `client/src/webview.rs`
  - `client/src/ipc/rpc.rs`
  - `client/src/ipc/router.rs`
- Existing dapp conventions from:
  - `dapp-examples/README.md`
  - `dapp-examples/constraints.md`
  - `dapp-examples/aave-v3/src/main.tsx`
  - `dapp-examples/uniswap-v2/src/clients.ts`
- EternalSafe decentralized patterns from:
  - `../wallet/src/store/addedTxsSlice.ts`
  - `../wallet/src/hooks/useMagicLink.ts`
  - `../wallet/src/services/tx/tx-sender/dispatch.ts`
  - `../wallet/src/hooks/loadables/useLoadTxQueue.ts`
  - `../wallet/src/hooks/loadables/useLoadTxHistory.ts`

## 3. Hard Constraints
1. No backend dependency for tx propose/sign/execute.
2. Must work under Vibefi CSP/IPC constraints (`connect-src 'none'` in the dapp webview).
3. Must stay within `dapp-examples/constraints.md` package and artifact rules.
4. Must use injected `window.ethereum` for write operations.

## 4. MVP Capability Scope
1. Connect wallet and enforce supported chain.
2. Load Safe by `chainId + safeAddress`; show owners, threshold, nonce, and balance.
3. Compose Safe tx for:
   - Native ETH transfer.
   - Generic contract call (`to`, `value`, `data`, `operation`).
4. Propose tx locally and persist tx payload + signatures in local storage.
5. Share/import tx via smart link (serialized tx payload).
6. Sign tx:
   - EOA owners via EIP-712 (`eth_signTypedData_v4`).
   - Contract-wallet owners via on-chain `approveHash`.
7. Execute tx when threshold is met and nonce is executable.
8. Show queue (local pending txs) and history (on-chain executed txs).
9. Admin actions (minimum):
   - Add owner.
   - Remove owner.
   - Swap owner.
   - Change threshold.

## 5. Non-Goals (MVP)
1. Safe Message service flows.
2. Cross-device sync without explicit export/import or smart links.
3. Full module marketplace or broad policy UX.
4. Multi-chain-first scope (start with mainnet, extend later).

## 6. Architecture
1. Frontend stack: React + Vite + `viem`/`wagmi` style aligned with existing examples.
2. Contract access:
   - Safe ABI JSON in `dapp-examples/safe-admin/abis/`.
   - Direct RPC calls (`eth_call`, `eth_getLogs`, `eth_estimateGas`, wallet send flow).
3. State model:
   - `safeContext`: chainId, safeAddress, version, owners, threshold, nonce.
   - `localTxStore`: `{chainId}:{safe}:{safeTxHash}` -> tx data, signatures, status, timestamps.
   - `historyStore`: derived from on-chain execution events.
4. Sync model:
   - Queue = local proposals minus executed tx hashes found on-chain.
   - History = on-chain logs + decoded calldata summaries.
   - Smart-link import merges/upserts local tx records.
5. Security checks:
   - Show sign/execute only for owners.
   - Validate tx nonce against current Safe nonce.
   - Sort signatures by owner address before execution encoding.
   - Always display raw calldata and decoded preview before user confirmation.

## 7. UX Surface (Minimal)
1. Safe select screen:
   - Input/paste Safe address.
   - Validate contract and basic Safe compatibility.
2. Overview:
   - Owners, threshold, nonce, network, balance.
3. New transaction:
   - ETH transfer form.
   - Advanced contract call form.
4. Queue:
   - Pending tx cards with signature count and nonce ordering.
   - Actions: view, sign, execute, share.
5. Transaction detail:
   - Full payload + decoded summary.
   - Signature/approval state per owner.
   - Contextual CTA: sign, approve hash, or execute.
6. History:
   - Executed tx list from chain logs.
   - Receipt link and decoded summary.
7. Settings/admin:
   - Owner management forms.
   - Threshold change form.
   - All admin changes produce standard Safe tx proposals.

## 8. Core Transaction Flow
1. Build canonical Safe transaction object.
2. Derive `safeTxHash` per Safe hashing rules.
3. Proposal step stores tx object locally.
4. Sign step:
   - EOA: collect EIP-712 signature and store locally.
   - Contract owner: send `approveHash(safeTxHash)` and mark approval locally.
5. Execute step:
   - Assemble signatures/approvals payload in required order.
   - Call `execTransaction(...)`.
   - On receipt success, mark tx executed and move it from queue to history.

## 9. Vibefi Runtime Compatibility Checklist
1. Call `eth_requestAccounts` before signing/executing.
2. Use only supported RPC paths and wallet-mediated sending.
3. Avoid arbitrary HTTP fetch assumptions in dapp runtime.
4. Keep output files and dependencies compliant with `dapp-examples/constraints.md`.

## 10. Proposed File Layout
1. `dapp-examples/safe-admin/src/App.tsx`
2. `dapp-examples/safe-admin/src/clients.ts`
3. `dapp-examples/safe-admin/src/addresses.ts`
4. `dapp-examples/safe-admin/src/abis.ts`
5. `dapp-examples/safe-admin/src/store/txStore.ts`
6. `dapp-examples/safe-admin/src/hooks/useSafeInfo.ts`
7. `dapp-examples/safe-admin/src/hooks/useTxQueue.ts`
8. `dapp-examples/safe-admin/src/hooks/useTxHistory.ts`
9. `dapp-examples/safe-admin/src/hooks/useSmartLink.ts`
10. `dapp-examples/safe-admin/src/components/*`
11. `dapp-examples/safe-admin/abis/Safe.json`
12. `dapp-examples/safe-admin/vibefi.json`

## 11. Delivery Phases
1. Phase 1: Read-only safe load + overview + history.
2. Phase 2: Propose/sign/execute generic tx + smart links.
3. Phase 3: Owner/threshold admin actions.
4. Phase 4: Hardening (nonce conflicts, signature edge cases, error UX, regression tests).

## 12. Key Risks / Open Decisions
1. Whether to request Safe SDK dependencies or keep a pure `viem` implementation.
2. Mainnet-only MVP versus multi-chain MVP.
3. Whether modules/guards belong in MVP or a follow-up phase.
4. How deeply to index on-chain approvals (`approveHash`) vs local-only signature state.

## 13. External Protocol References
- Safe signatures overview: `https://docs.safe.global/home/glossary#off-chain-transaction-signatures`
- `checkNSignatures`: `https://docs.safe.global/reference-smart-account/signatures/checknsignatures`
- `getTransactionHash`: `https://docs.safe.global/reference-smart-account/transactions/gettransactionhash`
- `execTransaction`: `https://docs.safe.global/reference-smart-account/transactions/exectransaction`
- Safe tx service API (contrast with backend-less approach): `https://docs.safe.global/core-api/transaction-service-reference/gnosis`
