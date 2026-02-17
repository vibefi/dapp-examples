import { type FormEvent, useEffect, useMemo, useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { ExecutionHistoryCard } from "./components/ExecutionHistoryCard";
import { TokenBalancesCard } from "./components/TokenBalancesCard";
import { getConfiguredChainId, getRpcUrl } from "./env";
import { useTokenBalances } from "./hooks/useTokenBalances";
import { DEFAULT_HISTORY_LOOKBACK_BLOCKS, isSafeContract, loadSafeExecutionHistory, loadSafeOverview } from "./safe";
import { APP_CSS } from "./styles/appCss";
import type { SafeExecutionHistoryItem, SafeOverview } from "./types";
import { mergeHistory, sortHistory } from "./utils/history";
import { formatEtherDisplay } from "./utils/format";

export default function App() {
  const configuredChainId = getConfiguredChainId();
  const rpcUrl = getRpcUrl();

  const { address: walletAccount, chainId: walletChainId, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [safeInput, setSafeInput] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const safe = params.get("safe");
    return safe && isAddress(safe) ? getAddress(safe) : "";
  });
  const [overview, setOverview] = useState<SafeOverview | null>(null);
  const [history, setHistory] = useState<SafeExecutionHistoryItem[]>([]);
  const [activeSafeAddress, setActiveSafeAddress] = useState<Address | null>(null);
  const [historyStartBlock, setHistoryStartBlock] = useState<bigint | null>(null);
  const [historyEndBlock, setHistoryEndBlock] = useState<bigint | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTxNotice, setNewTxNotice] = useState<string | null>(null);

  const {
    customTokenInput,
    setCustomTokenInput,
    customTrackedTokens,
    trackedTokenAddresses,
    detectedTokenBalances,
    tokenBalanceError,
    isCheckingTokenBalances,
    checkedTokenCount,
    addCustomTokenFromInput,
    resetDetectedBalances,
  } = useTokenBalances(activeSafeAddress);

  const chainMismatch = useMemo(() => {
    if (!isConnected || walletChainId === undefined) return false;
    return walletChainId !== configuredChainId;
  }, [walletChainId, configuredChainId, isConnected]);

  async function onLoad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = safeInput.trim();

    if (!isAddress(trimmed)) {
      setError("Enter a valid Safe address.");
      return;
    }

    if (!publicClient) {
      setError("No public client available.");
      return;
    }

    const safeAddress = getAddress(trimmed) as Address;
    setSafeInput(safeAddress);
    setError(null);
    setLoading(true);
    resetDetectedBalances();

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
      resetDetectedBalances();
    } catch (nextError) {
      setOverview(null);
      setHistory([]);
      setActiveSafeAddress(null);
      setHistoryStartBlock(null);
      setHistoryEndBlock(null);
      setHasMoreHistory(false);
      setError(nextError instanceof Error ? nextError.message : "Failed to load Safe data.");
      resetDetectedBalances();
    } finally {
      setLoading(false);
    }
  }

  async function onFetchMoreHistory() {
    if (!activeSafeAddress || historyStartBlock === null || historyStartBlock === 0n) {
      setHasMoreHistory(false);
      return;
    }

    if (!publicClient) return;

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

  function onNewTransactionClick() {
    setNewTxNotice("New transaction flow is not implemented yet.");
  }

  useEffect(() => {
    if (!newTxNotice) return;

    const timeout = window.setTimeout(() => {
      setNewTxNotice(null);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [newTxNotice]);

  return (
    <div className="shell">
      <style>{APP_CSS}</style>
      <div className="appFrame">
        <aside className="sidebar">
          <div className="brand">
            <span className="brandMark">S</span>
            <div>
              <p className="brandTitle">Safe Wallet</p>
              <p className="brandSubtitle">Read-only admin</p>
            </div>
          </div>
          <button type="button" className="navPrimary" onClick={onNewTransactionClick}>
            New transaction
          </button>
          <nav className="nav">
            <p className="navHeading">Workspace</p>
            <span className="navItem active">Home</span>
            <span className="navItem">Assets</span>
            <span className="navItem">Transactions</span>
            <span className="navItem">Address book</span>
            <span className="navItem">Apps</span>
            <span className="navItem">Settings</span>
          </nav>
          <div className="sidebarInfo">
            <p>Configured chain: {configuredChainId}</p>
            <p>Wallet chain: {walletChainId ?? "unknown"}</p>
            <p>RPC: {rpcUrl ? "configured" : "fallback provider"}</p>
          </div>
        </aside>

        <main className="workspace">
          <header className="topbar card">
            <div>
              <h1>Safe Admin</h1>
              <p className="muted">Phase 1: read-only Safe overview and execution history.</p>
            </div>
            <div className="topbarBadges">
              <span className="badge">Wallet: {walletAccount ?? "not connected"}</span>
              <span className="badge">Target chain: {configuredChainId}</span>
            </div>
          </header>

          {newTxNotice ? (
            <div className="noticeBanner" role="status" aria-live="polite">
              {newTxNotice}
            </div>
          ) : null}

          <section className="card loadCard">
            <div className="sectionHead">
              <h2>Load Safe</h2>
              <span className="chip">{loading ? "Loading data..." : "Ready"}</span>
            </div>
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
            {chainMismatch ? <p className="warn">Wallet chain differs from configured chain.</p> : null}
            {error ? <p className="error">{error}</p> : null}
          </section>

          <div className="grid">
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
                    <div>{formatEtherDisplay(overview.balanceWei)} ETH</div>
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

            {overview ? (
              <TokenBalancesCard
                trackedTokenCount={trackedTokenAddresses.length}
                customTokenInput={customTokenInput}
                onCustomTokenInputChange={setCustomTokenInput}
                onAddCustomToken={addCustomTokenFromInput}
                customTrackedTokens={customTrackedTokens}
                tokenBalanceError={tokenBalanceError}
                detectedTokenBalances={detectedTokenBalances}
                isCheckingTokenBalances={isCheckingTokenBalances}
                checkedTokenCount={checkedTokenCount}
              />
            ) : (
              <section className="card emptyCard">
                <h2>Token Balances</h2>
                <p className="muted">Token balances appear after a Safe has been loaded.</p>
              </section>
            )}
          </div>

          <ExecutionHistoryCard
            overviewLoaded={Boolean(overview)}
            history={history}
            historyStartBlock={historyStartBlock}
            historyEndBlock={historyEndBlock}
            loading={loading}
            loadingMoreHistory={loadingMoreHistory}
            activeSafeAddress={activeSafeAddress}
            hasMoreHistory={hasMoreHistory}
            onFetchMoreHistory={() => void onFetchMoreHistory()}
          />
        </main>
      </div>
    </div>
  );
}
