import { type FormEvent, useEffect, useMemo, useState } from "react";
import { getAddress, isAddress, zeroAddress, type Address, type Hex } from "viem";
import { useAccount, useConnect, usePublicClient } from "wagmi";
import { injected } from "wagmi/connectors";
import { AddressBookCard } from "./components/AddressBookCard";
import { ExecutionHistoryCard } from "./components/ExecutionHistoryCard";
import { ProposedTransactionsCard } from "./components/ProposedTransactionsCard";
import { SettingsCard } from "./components/SettingsCard";
import { TokenBalancesCard } from "./components/TokenBalancesCard";
import { getConfiguredChainId, getRpcUrl } from "./env";
import { useTokenBalances } from "./hooks/useTokenBalances";
import { DEFAULT_HISTORY_LOOKBACK_BLOCKS, getSafeTransactionHash, isSafeContract, loadSafeExecutionHistory, loadSafeOverview } from "./safe";
import type {
  SafeExecutionHistoryItem,
  SafeOverview,
  SafeProposalSignature,
  SafeProposedTransaction,
  SafeTransactionPayload,
  SharedSafeProposalPayload,
} from "./types";
import { ADDRESS_BOOK_STORAGE_KEY, loadAddressBookEntries, saveAddressBookEntries, type AddressBookEntry } from "./utils/addressBook";
import { mergeHistory, sortHistory } from "./utils/history";
import { formatEtherDisplay, shortAddress } from "./utils/format";
import {
  computeSafeTxHash,
  isSignatureValidForOwner,
  loadSafeProposals,
  mergeSignatures,
  parseSharedProposalPayload,
  saveSafeProposals,
} from "./utils/proposals";

type WorkspaceTab = "home" | "assets" | "transactions" | "proposals" | "address-book" | "settings" | "apps";

export default function App() {
  const configuredChainId = getConfiguredChainId();
  const rpcUrl = getRpcUrl();

  const { address: walletAccount, chainId: walletChainId, isConnected } = useAccount();
  const { connect, isPending: isConnecting, error: connectError } = useConnect();
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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("home");
  const [addressBookEntries, setAddressBookEntries] = useState<AddressBookEntry[]>(() => loadAddressBookEntries());
  const [proposals, setProposals] = useState<SafeProposedTransaction[]>(() => loadSafeProposals());

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

  const walletIsSignerForLoadedSafe = useMemo(() => {
    if (!overview || !walletAccount || !isConnected) return false;
    return overview.owners.some((owner) => owner.toLowerCase() === walletAccount.toLowerCase());
  }, [overview, walletAccount, isConnected]);

  const signerActionGateReason = useMemo(() => {
    if (!overview) return "Load a Safe on Home first.";
    if (!isConnected || !walletAccount) return "Connect a signer wallet to continue.";
    if (!walletIsSignerForLoadedSafe) return "Connected wallet is not a signer for the loaded Safe.";
    return null;
  }, [overview, isConnected, walletAccount, walletIsSignerForLoadedSafe]);

  const addressBookNamesByAddress = useMemo(() => {
    return new Map(addressBookEntries.map((entry) => [entry.address.toLowerCase(), entry.name]));
  }, [addressBookEntries]);

  function formatAddressWithBook(address: Address, fallback: (value: Address) => string): string {
    const name = addressBookNamesByAddress.get(address.toLowerCase());
    if (!name) return fallback(address);
    return `${name} (${shortAddress(address)})`;
  }

  function formatAddressFull(address: Address): string {
    return formatAddressWithBook(address, (value) => value);
  }

  function formatAddressShort(address: Address): string {
    return formatAddressWithBook(address, shortAddress);
  }

  const workspaceSubtitle =
    activeTab === "home"
      ? "Phase 1: read-only Safe overview."
      : activeTab === "assets"
        ? "Current token balances and transfer proposals for the loaded Safe."
        : activeTab === "transactions"
          ? "Execution history for the loaded Safe."
          : activeTab === "proposals"
            ? "Sign, share, import, and execute proposed Safe transactions."
            : activeTab === "address-book"
              ? "Saved addresses for reusable transaction targets."
              : activeTab === "settings"
                ? "Propose signer and threshold management transactions."
                : "Safe Apps integration is coming soon.";

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

  function onConnectWalletClick() {
    connect({ connector: injected() });
  }

  async function onCreateProposal(draft: {
    title: string;
    description: string | null;
    to: Address;
    value: bigint;
    data: Hex;
    operation: 0 | 1;
  }) {
    if (!overview) throw new Error("Load a Safe on Home before creating proposals.");
    if (!publicClient) throw new Error("No public client available.");
    if (!isConnected || !walletAccount) throw new Error("Connect a signer wallet before creating proposals.");
    if (!walletIsSignerForLoadedSafe) throw new Error("Connected wallet is not a signer for the loaded Safe.");

    const pendingNonces = new Set(
      proposals
        .filter(
          (proposal) =>
            proposal.chainId === overview.chainId &&
            proposal.safeAddress.toLowerCase() === overview.safeAddress.toLowerCase() &&
            proposal.executedTxHash === null,
        )
        .map((proposal) => proposal.tx.nonce.toString()),
    );
    let nextNonce = overview.nonce;
    while (pendingNonces.has(nextNonce.toString())) nextNonce += 1n;

    const tx: SafeTransactionPayload = {
      to: draft.to,
      value: draft.value,
      data: draft.data,
      operation: draft.operation,
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: zeroAddress,
      refundReceiver: zeroAddress,
      nonce: nextNonce,
    };

    let safeTxHash: Hex;
    try {
      safeTxHash = await getSafeTransactionHash(publicClient, overview.safeAddress, tx);
    } catch {
      safeTxHash = computeSafeTxHash(overview.safeAddress, overview.chainId, tx);
    }

    const now = Date.now();
    const proposal: SafeProposedTransaction = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${now}`,
      createdAtMs: now,
      updatedAtMs: now,
      chainId: overview.chainId,
      safeAddress: overview.safeAddress,
      safeTxHash,
      title: draft.title,
      description: draft.description,
      tx,
      signatures: [],
      executedTxHash: null,
      executedAtMs: null,
    };

    setProposals((current) => {
      const existingIndex = current.findIndex(
        (entry) =>
          entry.safeTxHash.toLowerCase() === proposal.safeTxHash.toLowerCase() &&
          entry.safeAddress.toLowerCase() === proposal.safeAddress.toLowerCase() &&
          entry.chainId === proposal.chainId,
      );
      if (existingIndex < 0) return [proposal, ...current];

      const next = [...current];
      next[existingIndex] = {
        ...next[existingIndex],
        title: proposal.title,
        description: proposal.description,
        tx: proposal.tx,
        updatedAtMs: now,
      };
      return next;
    });
  }

  function onAddProposalSignature(safeTxHash: Hex, signature: SafeProposalSignature) {
    setProposals((current) =>
      current.map((proposal) =>
        proposal.safeTxHash.toLowerCase() !== safeTxHash.toLowerCase()
          ? proposal
          : {
              ...proposal,
              signatures: mergeSignatures(proposal.signatures, [signature]),
              updatedAtMs: Date.now(),
            },
      ),
    );
  }

  function onMarkProposalExecuted(safeTxHash: Hex, txHash: Hex) {
    setProposals((current) =>
      current.map((proposal) =>
        proposal.safeTxHash.toLowerCase() !== safeTxHash.toLowerCase()
          ? proposal
          : {
              ...proposal,
              executedTxHash: txHash,
              executedAtMs: Date.now(),
              updatedAtMs: Date.now(),
            },
      ),
    );
  }

  function onRemoveProposal(safeTxHash: Hex) {
    setProposals((current) => current.filter((proposal) => proposal.safeTxHash.toLowerCase() !== safeTxHash.toLowerCase()));
  }

  async function onImportSharedPayload(rawPayload: SharedSafeProposalPayload) {
    const payload = parseSharedProposalPayload(rawPayload);
    if (!payload) throw new Error("Invalid shared proposal payload.");

    const tx: SafeTransactionPayload = {
      to: payload.tx.to,
      value: BigInt(payload.tx.value),
      data: payload.tx.data,
      operation: payload.tx.operation,
      safeTxGas: BigInt(payload.tx.safeTxGas),
      baseGas: BigInt(payload.tx.baseGas),
      gasPrice: BigInt(payload.tx.gasPrice),
      gasToken: payload.tx.gasToken,
      refundReceiver: payload.tx.refundReceiver,
      nonce: BigInt(payload.tx.nonce),
    };

    const computedHash = computeSafeTxHash(payload.safeAddress, payload.chainId, tx);
    if (computedHash.toLowerCase() !== payload.safeTxHash.toLowerCase()) {
      throw new Error("Shared payload hash does not match payload transaction.");
    }

    const validSignatures: SafeProposalSignature[] = [];
    for (const entry of payload.signatures) {
      const valid = await isSignatureValidForOwner(payload.safeTxHash, entry.owner, entry.signature);
      if (valid) validSignatures.push(entry);
    }

    const now = Date.now();
    setProposals((current) => {
      const existingIndex = current.findIndex(
        (entry) =>
          entry.safeTxHash.toLowerCase() === payload.safeTxHash.toLowerCase() &&
          entry.safeAddress.toLowerCase() === payload.safeAddress.toLowerCase() &&
          entry.chainId === payload.chainId,
      );

      if (existingIndex < 0) {
        const proposal: SafeProposedTransaction = {
          id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${now}`,
          createdAtMs: now,
          updatedAtMs: now,
          chainId: payload.chainId,
          safeAddress: payload.safeAddress,
          safeTxHash: payload.safeTxHash,
          title: payload.title ?? "Imported transaction",
          description: payload.description ?? null,
          tx,
          signatures: mergeSignatures([], validSignatures),
          executedTxHash: null,
          executedAtMs: null,
        };
        return [proposal, ...current];
      }

      const next = [...current];
      const existing = next[existingIndex];
      next[existingIndex] = {
        ...existing,
        title: payload.title ?? existing.title,
        description: payload.description ?? existing.description,
        signatures: mergeSignatures(existing.signatures, validSignatures),
        updatedAtMs: now,
      };
      return next;
    });
  }

  useEffect(() => {
    if (!newTxNotice) return;
    const timeout = window.setTimeout(() => setNewTxNotice(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [newTxNotice]);

  useEffect(() => {
    saveAddressBookEntries(addressBookEntries);
  }, [addressBookEntries]);

  useEffect(() => {
    saveSafeProposals(proposals);
  }, [proposals]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== ADDRESS_BOOK_STORAGE_KEY) return;
      setAddressBookEntries(loadAddressBookEntries());
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <div className="shell">
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
            <button type="button" className={`navItem navTab ${activeTab === "home" ? "active" : ""}`} onClick={() => setActiveTab("home")} aria-current={activeTab === "home" ? "page" : undefined}>
              Home
            </button>
            <button type="button" className={`navItem navTab ${activeTab === "assets" ? "active" : ""}`} onClick={() => setActiveTab("assets")} aria-current={activeTab === "assets" ? "page" : undefined}>
              Assets
            </button>
            <button type="button" className={`navItem navTab ${activeTab === "transactions" ? "active" : ""}`} onClick={() => setActiveTab("transactions")} aria-current={activeTab === "transactions" ? "page" : undefined}>
              Transactions
            </button>
            <button type="button" className={`navItem navTab ${activeTab === "proposals" ? "active" : ""}`} onClick={() => setActiveTab("proposals")} aria-current={activeTab === "proposals" ? "page" : undefined}>
              Proposals
            </button>
            <button type="button" className={`navItem navTab ${activeTab === "address-book" ? "active" : ""}`} onClick={() => setActiveTab("address-book")} aria-current={activeTab === "address-book" ? "page" : undefined}>
              Address book
            </button>
            <button type="button" className={`navItem navTab ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")} aria-current={activeTab === "settings" ? "page" : undefined}>
              Settings
            </button>
            <button type="button" className={`navItem navTab ${activeTab === "apps" ? "active" : ""}`} onClick={() => setActiveTab("apps")} aria-current={activeTab === "apps" ? "page" : undefined}>
              Apps
            </button>
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
              <p className="muted">{workspaceSubtitle}</p>
            </div>
            <div className="topbarBadges">
              <span className="badge">Wallet: {walletAccount ? formatAddressFull(walletAccount) : "not connected"}</span>
              <span className="badge">Target chain: {configuredChainId}</span>
              {!isConnected ? (
                <button type="button" className="secondary" onClick={onConnectWalletClick} disabled={isConnecting}>
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </button>
              ) : null}
            </div>
          </header>

          {newTxNotice ? (
            <div className="noticeBanner" role="status" aria-live="polite">
              {newTxNotice}
            </div>
          ) : null}
          {connectError ? <p className="error">{connectError.message}</p> : null}

          {activeTab === "home" ? (
            <section className="card loadCard">
              <div className="sectionHead">
                <h2>Load Safe</h2>
                <span className="chip">{loading ? "Loading data..." : "Ready"}</span>
              </div>
              <form onSubmit={onLoad} className="form">
                <label htmlFor="safeAddress">Safe Address</label>
                <div className="row">
                  <input id="safeAddress" value={safeInput} onChange={(event) => setSafeInput(event.target.value)} placeholder="0x..." autoComplete="off" spellCheck={false} />
                  <button type="submit" disabled={loading}>
                    {loading ? "Loading..." : "Load"}
                  </button>
                </div>
              </form>
              {chainMismatch ? <p className="warn">Wallet chain differs from configured chain.</p> : null}
              {error ? <p className="error">{error}</p> : null}
            </section>
          ) : null}

          {activeTab === "home" ? (
            <section className="card">
              <h2>Overview</h2>
              {!overview ? (
                <p className="muted">Load a Safe to view owners, threshold, nonce, and balance.</p>
              ) : (
                <>
                  <div className="kvs">
                    <div>Safe</div>
                    <div>{formatAddressFull(overview.safeAddress)}</div>
                    <div>Version</div>
                    <div>{overview.version ?? "unknown"}</div>
                    <div>Threshold</div>
                    <div>{overview.threshold}</div>
                    <div>Nonce</div>
                    <div>{overview.nonce.toString()}</div>
                    <div>Balance</div>
                    <div>{formatEtherDisplay(overview.balanceWei)} ETH</div>
                    <div>Guard</div>
                    <div>{overview.guard ? formatAddressFull(overview.guard) : "not set"}</div>
                    <div>Fallback Handler</div>
                    <div>{overview.fallbackHandler ? formatAddressFull(overview.fallbackHandler) : "not set"}</div>
                    <div>Modules</div>
                    <div>{overview.modules.length ? overview.modules.map((module) => formatAddressFull(module)).join(", ") : "none"}</div>
                  </div>
                  <h3>Owners ({overview.owners.length})</h3>
                  <ul className="list">
                    {overview.owners.map((owner) => (
                      <li key={owner}>{formatAddressFull(owner)}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          ) : null}

          {activeTab === "assets" ? (
            overview ? (
              <TokenBalancesCard
                safeAddress={overview.safeAddress}
                canPropose={walletIsSignerForLoadedSafe}
                proposeDisabledReason={signerActionGateReason}
                trackedTokenCount={trackedTokenAddresses.length}
                customTokenInput={customTokenInput}
                onCustomTokenInputChange={setCustomTokenInput}
                onAddCustomToken={addCustomTokenFromInput}
                customTrackedTokens={customTrackedTokens}
                tokenBalanceError={tokenBalanceError}
                detectedTokenBalances={detectedTokenBalances}
                isCheckingTokenBalances={isCheckingTokenBalances}
                checkedTokenCount={checkedTokenCount}
                formatAddressShort={formatAddressShort}
                formatAddressFull={formatAddressFull}
                onCreateProposal={onCreateProposal}
              />
            ) : (
              <section className="card emptyCard">
                <h2>Token Balances</h2>
                <p className="muted">Token balances appear after a Safe has been loaded.</p>
              </section>
            )
          ) : null}

          {activeTab === "transactions" ? (
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
              formatAddressShort={formatAddressShort}
              formatAddressFull={formatAddressFull}
            />
          ) : null}

          {activeTab === "proposals" ? (
            <ProposedTransactionsCard
              overview={overview}
              walletAccount={walletAccount ?? null}
              isConnected={isConnected}
              canManage={walletIsSignerForLoadedSafe}
              manageDisabledReason={signerActionGateReason}
              proposals={proposals}
              formatAddressFull={formatAddressFull}
              onAddSignature={onAddProposalSignature}
              onMarkExecuted={onMarkProposalExecuted}
              onRemoveProposal={onRemoveProposal}
              onImportSharedPayload={onImportSharedPayload}
            />
          ) : null}

          {activeTab === "address-book" ? <AddressBookCard entries={addressBookEntries} onEntriesChange={setAddressBookEntries} /> : null}

          {activeTab === "settings" ? (
            <SettingsCard
              overview={overview}
              formatAddressFull={formatAddressFull}
              onCreateProposal={onCreateProposal}
              canPropose={walletIsSignerForLoadedSafe}
              proposeDisabledReason={signerActionGateReason}
            />
          ) : null}

          {activeTab === "apps" ? (
            <section className="card">
              <h2>Apps</h2>
              <p className="muted">Not yet implemented. Coming soon.</p>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
