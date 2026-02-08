import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatEther, formatUnits, getAddress, isAddress, type Address } from "viem";
import { getConnectedAccount, getConnectedChainId, publicClient } from "./clients";
import { getConfiguredChainId, getRpcUrl } from "./env";
import { DEFAULT_HISTORY_LOOKBACK_BLOCKS, isSafeContract, loadSafeExecutionHistory, loadSafeOverview } from "./safe";
import type { DecodedErc20Call, SafeExecutionHistoryItem, SafeOverview, TokenMetadata } from "./types";

export default function App() {
  const configuredChainId = getConfiguredChainId();
  const rpcUrl = getRpcUrl();

  const [safeInput, setSafeInput] = useState("");
  const [overview, setOverview] = useState<SafeOverview | null>(null);
  const [history, setHistory] = useState<SafeExecutionHistoryItem[]>([]);
  const [activeSafeAddress, setActiveSafeAddress] = useState<`0x${string}` | null>(null);
  const [historyStartBlock, setHistoryStartBlock] = useState<bigint | null>(null);
  const [historyEndBlock, setHistoryEndBlock] = useState<bigint | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAccount, setWalletAccount] = useState<`0x${string}` | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const safe = params.get("safe");
    if (safe && isAddress(safe)) {
      setSafeInput(getAddress(safe));
    }

    void refreshWalletState();
  }, []);

  const chainMismatch = useMemo(() => {
    if (walletChainId === null) return false;
    return walletChainId !== configuredChainId;
  }, [walletChainId, configuredChainId]);

  async function refreshWalletState() {
    try {
      const [account, chainId] = await Promise.all([getConnectedAccount(), getConnectedChainId()]);
      setWalletAccount(account);
      setWalletChainId(chainId);
    } catch {
      setWalletAccount(null);
      setWalletChainId(null);
    }
  }

  async function onLoad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = safeInput.trim();

    if (!isAddress(trimmed)) {
      setError("Enter a valid Safe address.");
      return;
    }

    const safeAddress = getAddress(trimmed) as `0x${string}`;
    setSafeInput(safeAddress);
    setError(null);
    setLoading(true);

    try {
      const validSafe = await isSafeContract(publicClient, safeAddress);
      if (!validSafe) {
        throw new Error("Address is not a compatible Safe contract on the configured chain.");
      }

      const latestBlock = await publicClient.getBlockNumber();
      const windowOffset = DEFAULT_HISTORY_LOOKBACK_BLOCKS - 1n;
      const fromBlock = latestBlock > windowOffset ? latestBlock - windowOffset : 0n;

      const [nextOverview, initialHistory] = await Promise.all([
        loadSafeOverview(publicClient, safeAddress),
        loadSafeExecutionHistory(publicClient, safeAddress, { fromBlock, toBlock: latestBlock }),
      ]);

      setOverview(nextOverview);
      setHistory(sortHistory(initialHistory));
      setActiveSafeAddress(safeAddress);
      setHistoryStartBlock(fromBlock);
      setHistoryEndBlock(latestBlock);
      setHasMoreHistory(fromBlock > 0n);
    } catch (nextError) {
      setOverview(null);
      setHistory([]);
      setActiveSafeAddress(null);
      setHistoryStartBlock(null);
      setHistoryEndBlock(null);
      setHasMoreHistory(false);
      setError(nextError instanceof Error ? nextError.message : "Failed to load Safe data.");
    } finally {
      setLoading(false);
    }
  }

  async function onFetchMoreHistory() {
    if (!activeSafeAddress || historyStartBlock === null || historyStartBlock === 0n) {
      setHasMoreHistory(false);
      return;
    }

    setLoadingMoreHistory(true);
    setError(null);

    try {
      const nextToBlock = historyStartBlock - 1n;
      const windowOffset = DEFAULT_HISTORY_LOOKBACK_BLOCKS - 1n;
      const nextFromBlock = nextToBlock > windowOffset ? nextToBlock - windowOffset : 0n;

      const olderHistory = await loadSafeExecutionHistory(publicClient, activeSafeAddress, {
        fromBlock: nextFromBlock,
        toBlock: nextToBlock,
      });

      setHistory((current) => mergeHistory(current, olderHistory));
      setHistoryStartBlock(nextFromBlock);
      setHasMoreHistory(nextFromBlock > 0n);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to fetch older history window.");
    } finally {
      setLoadingMoreHistory(false);
    }
  }

  return (
    <div className="shell">
      <style>{CSS}</style>
      <main className="page">
        <section className="card">
          <h1>Safe Admin</h1>
          <p className="muted">Phase 1: read-only Safe overview and execution history.</p>
          <div className="kvs">
            <div>Configured chain</div>
            <div>{configuredChainId}</div>
            <div>RPC_URL</div>
            <div>{rpcUrl ? "configured" : "missing (uses injected provider if available)"}</div>
            <div>Wallet account</div>
            <div>{walletAccount ?? "not connected"}</div>
            <div>Wallet chain</div>
            <div>{walletChainId ?? "unknown"}</div>
          </div>
          {chainMismatch ? <p className="warn">Wallet chain differs from configured chain.</p> : null}
        </section>

        <section className="card">
          <form onSubmit={onLoad} className="form">
            <label htmlFor="safeAddress">Safe Address</label>
            <div className="row">
              <input
                id="safeAddress"
                value={safeInput}
                onChange={(event) => setSafeInput(event.target.value)}
                placeholder="0x..."
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" disabled={loading}>
                {loading ? "Loading..." : "Load"}
              </button>
            </div>
          </form>
          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="card">
          <h2>Overview</h2>
          {!overview ? (
            <p className="muted">Load a Safe to view owners, threshold, nonce, and balance.</p>
          ) : (
            <>
              <div className="kvs">
                <div>Safe</div>
                <div>{overview.safeAddress}</div>
                <div>Version</div>
                <div>{overview.version ?? "unknown"}</div>
                <div>Threshold</div>
                <div>{overview.threshold}</div>
                <div>Nonce</div>
                <div>{overview.nonce.toString()}</div>
                <div>Balance</div>
                <div>{formatEther(overview.balanceWei)} ETH</div>
                <div>Guard</div>
                <div>{overview.guard ?? "not set"}</div>
                <div>Fallback Handler</div>
                <div>{overview.fallbackHandler ?? "not set"}</div>
                <div>Modules</div>
                <div>{overview.modules.length ? overview.modules.join(", ") : "none"}</div>
              </div>
              <h3>Owners ({overview.owners.length})</h3>
              <ul className="list">
                {overview.owners.map((owner) => (
                  <li key={owner}>{owner}</li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card">
          <h2>Execution History</h2>
          {overview ? (
            <div className="historyToolbar">
              <p className="muted">
                Showing block window {formatOptionalBlock(historyStartBlock)} - {formatOptionalBlock(historyEndBlock)}.
                Click fetch to load the previous {formatBlocks(DEFAULT_HISTORY_LOOKBACK_BLOCKS)} blocks.
              </p>
              <button
                type="button"
                className="secondary"
                onClick={() => void onFetchMoreHistory()}
                disabled={loading || loadingMoreHistory || !activeSafeAddress || !hasMoreHistory}
              >
                {loadingMoreHistory ? "Fetching previous..." : hasMoreHistory ? "Fetch previous 250k blocks" : "Reached genesis"}
              </button>
            </div>
          ) : null}

          {!overview ? (
            <p className="muted">History appears after loading a Safe.</p>
          ) : history.length === 0 ? (
            <p className="muted">No executions found in the current block window.</p>
          ) : (
            <ul className="historyList">
              {history.map((item) => {
                const decoded = item.decodedExecTransaction;
                return (
                  <li key={`${item.transactionHash}-${item.blockNumber}`} className="historyItem">
                    <div className="historyTitle">{decoded ? describeOperation(decoded.operation) : "Execution"}</div>
                    <div className="kvs compact">
                      <div>Block</div>
                      <div>{item.blockNumber.toString()}</div>
                      <div>Tx Hash</div>
                      <div>{item.transactionHash}</div>
                      <div>Safe Tx Hash</div>
                      <div>{item.safeTxHash}</div>
                      <div>Time</div>
                      <div>{formatTimestamp(item.timestampMs)}</div>
                      <div>Payment</div>
                      <div>{formatEther(item.paymentWei)} ETH</div>
                      <div>To</div>
                      <div>{decoded?.to ?? "unavailable"}</div>
                      <div>Value</div>
                      <div>{decoded ? `${formatEther(decoded.value)} ETH` : "unavailable"}</div>
                      <div>Operation</div>
                      <div>{decoded ? describeOperation(decoded.operation) : "unavailable"}</div>
                    </div>

                    {item.targetContractToken ? (
                      <p className="infoLine">Target contract token: {formatTokenLabel(item.targetContractToken)}</p>
                    ) : null}

                    {item.decodedErc20Call ? <p className="infoLine">ERC20 call: {formatErc20Call(item.decodedErc20Call)}</p> : null}

                    {item.erc20Transfers.length > 0 ? (
                      <>
                        <p className="infoLine">ERC20 transfers in tx:</p>
                        <ul className="list compactList">
                          {item.erc20Transfers.map((transfer, index) => (
                            <li key={`${item.transactionHash}-transfer-${index}`}>
                              {formatTokenAmount(transfer.amount, transfer.token)} of {formatTokenLabel(transfer.token)} from{" "}
                              {shortAddress(transfer.from)} to {shortAddress(transfer.to)}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function sortHistory(items: SafeExecutionHistoryItem[]): SafeExecutionHistoryItem[] {
  return [...items].sort((left, right) => {
    if (left.blockNumber !== right.blockNumber) {
      return left.blockNumber > right.blockNumber ? -1 : 1;
    }
    return left.transactionHash.localeCompare(right.transactionHash);
  });
}

function mergeHistory(current: SafeExecutionHistoryItem[], incoming: SafeExecutionHistoryItem[]): SafeExecutionHistoryItem[] {
  const byKey = new Map<string, SafeExecutionHistoryItem>();
  for (const item of current) {
    byKey.set(item.transactionHash, item);
  }
  for (const item of incoming) {
    byKey.set(item.transactionHash, item);
  }
  return sortHistory(Array.from(byKey.values()));
}

function describeOperation(operation: 0 | 1) {
  return operation === 0 ? "CALL" : "DELEGATECALL";
}

function formatTimestamp(timestampMs: number | null) {
  if (!timestampMs) return "unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestampMs));
}

function formatBlocks(value: bigint): string {
  return Number(value).toLocaleString();
}

function formatOptionalBlock(value: bigint | null): string {
  if (value === null) return "-";
  return value.toString();
}

function shortAddress(value: Address): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatTokenLabel(token: TokenMetadata | null): string {
  if (!token) return "Unknown token";
  if (token.symbol) return token.symbol;
  if (token.name) return token.name;
  return shortAddress(token.address);
}

function formatTokenAmount(amount: bigint, token: TokenMetadata | null): string {
  if (token?.decimals !== null && token?.decimals !== undefined) {
    const unit = token.symbol ? ` ${token.symbol}` : "";
    return `${formatUnits(amount, token.decimals)}${unit}`;
  }
  return amount.toString();
}

function formatErc20Call(call: DecodedErc20Call): string {
  if (call.method === "transfer") {
    return `transfer ${formatTokenAmount(call.amount, call.token)} to ${shortAddress(call.to)}`;
  }
  if (call.method === "transferFrom") {
    return `transferFrom ${shortAddress(call.from)} -> ${shortAddress(call.to)} amount ${formatTokenAmount(call.amount, call.token)}`;
  }
  return `approve ${shortAddress(call.spender)} amount ${formatTokenAmount(call.amount, call.token)}`;
}

const CSS = `
:root {
  color: #0b152b;
  background: #f1f5f9;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
}
.shell {
  min-height: 100vh;
  background: radial-gradient(900px 500px at 10% 0%, #dbeafe, transparent),
              radial-gradient(700px 450px at 90% 20%, #cffafe, transparent),
              #f8fafc;
}
.page {
  width: min(1040px, 100%);
  margin: 0 auto;
  padding: 20px;
  display: grid;
  gap: 14px;
}
.card {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 14px;
}
h1 {
  margin: 0;
  font-size: 1.5rem;
}
h2 {
  margin: 0 0 10px;
  font-size: 1.05rem;
}
h3 {
  margin: 12px 0 8px;
  font-size: 0.95rem;
}
.form {
  display: grid;
  gap: 8px;
}
.row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}
input {
  min-width: 0;
  min-height: 38px;
  border: 1px solid #94a3b8;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 0.95rem;
}
button {
  min-height: 38px;
  border: 1px solid #075985;
  background: #0284c7;
  color: white;
  border-radius: 10px;
  padding: 8px 14px;
  font-weight: 700;
  cursor: pointer;
}
button:disabled {
  opacity: 0.7;
  cursor: wait;
}
button.secondary {
  background: #334155;
  border-color: #1e293b;
}
.kvs {
  display: grid;
  grid-template-columns: minmax(140px, 220px) 1fr;
  gap: 4px 12px;
}
.kvs.compact {
  grid-template-columns: minmax(100px, 180px) 1fr;
}
.kvs > div:nth-child(odd) {
  color: #475569;
}
.kvs > div {
  overflow-wrap: anywhere;
}
.list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 4px;
}
.compactList {
  margin-top: 4px;
}
.historyList {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}
.historyItem {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px;
}
.historyTitle {
  font-weight: 700;
  margin-bottom: 8px;
}
.historyToolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.infoLine {
  margin: 8px 0 0;
  color: #334155;
  font-size: 0.92rem;
}
.muted {
  color: #475569;
  margin: 6px 0 0;
}
.warn {
  color: #92400e;
  margin: 8px 0 0;
}
.error {
  color: #991b1b;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 8px;
  margin: 10px 0 0;
}
@media (max-width: 720px) {
  .page {
    padding: 12px;
  }
  .row {
    grid-template-columns: 1fr;
  }
  button {
    width: 100%;
  }
  .historyToolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
`;
