import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { maxUint256, parseEther } from "viem";
import { publicClient, getChainId, getWalletClient, hasRpcUrl, requestAccount, switchToMainnet } from "./clients";
import { ABI } from "./abis";
import { addresses, MAINNET_CHAIN_ID } from "./addresses";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { Field } from "./components/Field";
import { Toast } from "./components/Toast";
import { useAllowance } from "./hooks/useAllowance";
import { useErc20Balance } from "./hooks/useErc20Balance";
import { useEthBalance } from "./hooks/useEthBalance";
import { useQuote } from "./hooks/useQuote";
import { useTokenMeta } from "./hooks/useTokenMeta";
import { formatAmount, isAddressLike, nowPlusMinutes, safeParseUnits } from "./utils";
import logoUrl from "../assets/logo.webp";

type Tab = "ethToToken" | "tokenToEth";

function useInjectedEvents(onChange: () => void) {
  useEffect(() => {
    const eth = (window as unknown as { ethereum?: { on?: (e: string, cb: () => void) => void; removeListener?: (e: string, cb: () => void) => void } }).ethereum;
    if (!eth?.on) return;

    const handler = () => onChange();
    eth.on("accountsChanged", handler);
    eth.on("chainChanged", handler);

    return () => {
      eth.removeListener?.("accountsChanged", handler);
      eth.removeListener?.("chainChanged", handler);
    };
  }, [onChange]);
}

export default function App() {
  const [tab, setTab] = useState<Tab>("ethToToken");
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [slippageBps, setSlippageBps] = useState<string>("50"); // 0.50%
  const [slippageOpen, setSlippageOpen] = useState(false);
  const slip = useMemo(() => {
    const n = Number(slippageBps);
    if (!Number.isFinite(n) || n < 0) return 50;
    if (n > 2_000) return 2_000;
    return Math.floor(n);
  }, [slippageBps]);

  const refreshWalletState = async () => {
    try {
      const eth = (window as unknown as { ethereum?: unknown }).ethereum;
      if (!eth) {
        setAccount(null);
        setChainId(null);
        return;
      }
      const a = await requestSilentAccount();
      setAccount(a);
      setChainId(await getChainId());
    } catch {
      setAccount(null);
      setChainId(null);
    }
  };

  async function requestSilentAccount(): Promise<Address | null> {
    const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) return null;
    const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
    return (accounts?.[0] as Address | undefined) ?? null;
  }

  useEffect(() => {
    refreshWalletState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInjectedEvents(() => {
    refreshWalletState();
  });

  const ethBalance = useEthBalance(account ?? undefined);

  const needsMainnet = chainId !== null && chainId !== MAINNET_CHAIN_ID;

  async function onConnect() {
    try {
      const a = await requestAccount();
      setAccount(a as Address);
      setChainId(await getChainId());
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to connect wallet");
    }
  }

  async function onSwitchMainnet() {
    try {
      await switchToMainnet();
      setChainId(await getChainId());
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to switch network");
    }
  }

  function toggleTab() {
    setTab((t) => (t === "ethToToken" ? "tokenToEth" : "ethToToken"));
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(600px 400px at 50% 0%, rgba(255,0,122,0.12), transparent 70%), " +
          "radial-gradient(800px 600px at 50% 0%, rgba(255,0,122,0.06), transparent), " +
          "#0b0b10",
        color: "white",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}>
        <Header
          account={account}
          chainId={chainId}
          ethBalance={ethBalance}
          onConnect={onConnect}
          onSwitchMainnet={onSwitchMainnet}
        />

        <div style={{ paddingTop: 48 }}>
          <Card>
            {/* Title + Slippage row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Swap</div>
              <button
                onClick={() => setSlippageOpen((o) => !o)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: "4px 10px",
                  color: "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 14 }}>&#9881;</span>
                {(slip / 100).toFixed(2)}%
              </button>
            </div>

            {slippageOpen && (
              <div style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 12,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <span style={{ fontSize: 13, opacity: 0.7, whiteSpace: "nowrap" }}>Slippage (bps):</span>
                <input
                  value={slippageBps}
                  onChange={(e) => setSlippageBps(e.target.value)}
                  inputMode="numeric"
                  placeholder="50"
                  style={{
                    ...inputStyle(),
                    padding: "6px 10px",
                    fontSize: 13,
                    maxWidth: 80,
                  }}
                />
                <span style={{ fontSize: 12, opacity: 0.5 }}>50 = 0.50%</span>
              </div>
            )}

            {/* Pill tabs */}
            <div style={{
              display: "flex",
              gap: 4,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 20,
              padding: 4,
            }}>
              <TabPill active={tab === "ethToToken"} onClick={() => setTab("ethToToken")}>
                ETH &rarr; Token
              </TabPill>
              <TabPill active={tab === "tokenToEth"} onClick={() => setTab("tokenToEth")}>
                Token &rarr; ETH
              </TabPill>
            </div>

            {needsMainnet ? (
              <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,220,120,0.12)", border: "1px solid rgba(255,220,120,0.25)", fontSize: 13 }}>
                Connected to chainId <b>{chainId}</b>. This app is for <b>Ethereum mainnet (1)</b>. Switch networks to continue.
              </div>
            ) : null}

            {tab === "ethToToken" ? (
              <EthToToken
                account={account}
                disabled={!account || needsMainnet}
                slipBps={slip}
                onToast={setToast}
                onFlip={toggleTab}
                onConnect={onConnect}
              />
            ) : (
              <TokenToEth
                account={account}
                disabled={!account || needsMainnet}
                slipBps={slip}
                onToast={setToast}
                onFlip={toggleTab}
                onConnect={onConnect}
              />
            )}
          </Card>

          {/* Contracts footer */}
          <div style={{ marginTop: 16, padding: "12px 4px" }}>
            <ContractsFooter />
          </div>
        </div>
      </div>

      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}

/* ─── Header ─── */

function Header(props: {
  account: Address | null;
  chainId: number | null;
  ethBalance: bigint | null;
  onConnect: () => void;
  onSwitchMainnet: () => void;
}) {
  const short = props.account ? `${props.account.slice(0, 6)}…${props.account.slice(-4)}` : null;
  const balance = props.ethBalance !== null ? formatAmount(props.ethBalance, 18, 5) : null;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <img src={logoUrl} width={32} height={32} style={{ borderRadius: 10 }} />
        <span style={{ fontWeight: 700, fontSize: 15 }}>Uniswap V2</span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {props.account ? (
          <>
            {props.chainId !== null && props.chainId !== 1 && (
              <Button variant="ghost" onClick={props.onSwitchMainnet} style={{ fontSize: 12, padding: "6px 10px" }}>
                Switch to Mainnet
              </Button>
            )}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
              overflow: "hidden",
            }}>
              {balance !== null && (
                <span style={{ padding: "7px 10px", fontSize: 13, opacity: 0.85 }}>
                  {balance} ETH
                </span>
              )}
              <span style={{
                padding: "7px 12px",
                fontSize: 13,
                background: "rgba(255,255,255,0.06)",
                borderLeft: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                {props.chainId !== null && (
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: props.chainId === 1 ? "#27AE60" : "#E67E22",
                    display: "inline-block",
                  }} />
                )}
                {short}
              </span>
            </div>
          </>
        ) : (
          <Button onClick={props.onConnect} style={{ borderRadius: 20, padding: "8px 16px", fontSize: 14 }}>
            Connect Wallet
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Tab pill ─── */

function TabPill(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      style={{
        flex: 1,
        padding: "8px 0",
        borderRadius: 16,
        border: "none",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: 14,
        background: props.active ? "rgba(255,0,122,0.15)" : "transparent",
        color: props.active ? "#FF007A" : "rgba(255,255,255,0.5)",
        transition: "background 0.15s, color 0.15s",
        fontFamily: "inherit",
      }}
    >
      {props.children}
    </button>
  );
}

/* ─── Swap direction arrow ─── */

function SwapArrow(props: { onClick: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "-10px 0", position: "relative", zIndex: 2 }}>
      <button
        onClick={props.onClick}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "3px solid #1a1a24",
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.7)",
          cursor: "pointer",
          fontSize: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.15s",
        }}
        title="Switch direction"
      >
        ↓
      </button>
    </div>
  );
}

/* ─── Input panel wrapper ─── */

function InputPanel(props: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      borderRadius: 16,
      padding: "12px 14px",
      display: "grid",
      gap: 8,
    }}>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{props.label}</span>
      {props.children}
    </div>
  );
}

/* ─── Inline quote row ─── */

function QuoteRow(props: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      fontSize: 13,
      color: props.muted ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.7)",
    }}>
      <span>{props.label}</span>
      <span>{props.value}</span>
    </div>
  );
}

/* ─── ETH → Token ─── */

function EthToToken(props: { account: Address | null; disabled: boolean; slipBps: number; onToast: (s: string) => void; onFlip: () => void; onConnect: () => void }) {
  const [tokenOutRaw, setTokenOutRaw] = useState<string>("");
  const [ethIn, setEthIn] = useState<string>("0.01");

  const { meta: outMeta, error: tokenErr } = useTokenMeta(tokenOutRaw, "token");

  const amountIn = useMemo(() => {
    try {
      if (!ethIn.trim()) return null;
      return parseEther(ethIn as `${number}`);
    } catch {
      return null;
    }
  }, [ethIn]);

  const path = useMemo(() => {
    if (!outMeta) return null;
    return [addresses.WETH9 as Address, outMeta.address];
  }, [outMeta]);

  const quote = useQuote(amountIn, path);

  const minOut = useMemo(() => {
    if (quote.status !== "ready") return null;
    return (quote.amountOut * BigInt(10_000 - props.slipBps)) / 10_000n;
  }, [quote, props.slipBps]);

  async function onSwap() {
    if (props.disabled) return;
    if (!props.account) return props.onToast("Connect a wallet first.");
    if (!outMeta) return props.onToast("Enter a valid token address.");
    if (!amountIn || amountIn <= 0n) return props.onToast("Enter a valid ETH amount.");
    if (!minOut) return props.onToast("Quote not ready yet.");

    const walletClient = getWalletClient();
    if (!walletClient) return props.onToast("No injected wallet found (window.ethereum).");

    try {
      const deadline = nowPlusMinutes(10);
      const hash = await walletClient.writeContract({
        account: props.account,
        address: addresses.UniswapV2Router02 as Address,
        abi: ABI.router,
        functionName: "swapExactETHForTokens",
        args: [minOut, [addresses.WETH9 as Address, outMeta.address], props.account, deadline],
        value: amountIn,
      });
      props.onToast(`Swap submitted: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      props.onToast(`Swap confirmed in block ${receipt.blockNumber}`);
    } catch (e) {
      props.onToast(e instanceof Error ? e.message : "Swap failed");
    }
  }

  return (
    <div style={{ display: "grid", gap: 0 }}>
      {/* You pay */}
      <InputPanel label="You pay">
        <input
          value={ethIn}
          onChange={(e) => setEthIn(e.target.value)}
          inputMode="decimal"
          placeholder="0.0"
          style={amountInputStyle()}
        />
        <span style={{ fontSize: 13, opacity: 0.5 }}>ETH</span>
      </InputPanel>

      <SwapArrow onClick={props.onFlip} />

      {/* You receive */}
      <InputPanel label="You receive">
        <input
          value={tokenOutRaw}
          onChange={(e) => setTokenOutRaw(e.target.value.trim())}
          placeholder="Token address 0x…"
          style={{ ...inputStyle(), fontSize: 13 }}
        />
        {tokenErr && <div style={{ color: "#ff6b6b", fontSize: 12 }}>{tokenErr}</div>}
        <div style={amountDisplayStyle()}>
          {quote.status === "ready" && outMeta
            ? `${formatAmount(quote.amountOut, outMeta.decimals)} ${outMeta.symbol}`
            : quote.status === "loading"
              ? "Fetching…"
              : "—"}
        </div>
      </InputPanel>

      {/* Quote info */}
      {quote.status === "ready" && outMeta && minOut && (
        <div style={{ marginTop: 12, display: "grid", gap: 4, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
          <QuoteRow
            label={`1 ETH`}
            value={`≈ ${amountIn && amountIn > 0n ? formatAmount((quote.amountOut * parseEther("1")) / amountIn, outMeta.decimals) : "—"} ${outMeta.symbol}`}
          />
          <QuoteRow label={`Min received (${props.slipBps / 100}% slippage)`} value={`${formatAmount(minOut, outMeta.decimals)} ${outMeta.symbol}`} muted />
        </div>
      )}
      {quote.status === "error" && (
        <div style={{ marginTop: 8, color: "#ff6b6b", fontSize: 13 }}>{quote.error}</div>
      )}

      <div style={{ marginTop: 14 }}>
        {!props.account ? (
          <Button variant="cta" onClick={props.onConnect}>
            Connect Wallet
          </Button>
        ) : (
          <Button variant="cta" disabled={props.disabled || quote.status !== "ready"} onClick={onSwap}>
            {quote.status === "loading" ? "Fetching quote…" : "Swap"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Token → ETH ─── */

function TokenToEth(props: { account: Address | null; disabled: boolean; slipBps: number; onToast: (s: string) => void; onFlip: () => void; onConnect: () => void }) {
  const [tokenInRaw, setTokenInRaw] = useState<string>("");
  const [tokenInAmount, setTokenInAmount] = useState<string>("");

  const { meta: inMeta, error: tokenErr } = useTokenMeta(tokenInRaw, "token");

  const tokenBal = useErc20Balance(inMeta?.address, props.account ?? undefined);
  const allowance = useAllowance(inMeta?.address, props.account ?? undefined, addresses.UniswapV2Router02 as Address);

  const amountIn = useMemo(() => {
    if (!inMeta) return null;
    return safeParseUnits(tokenInAmount, inMeta.decimals);
  }, [tokenInAmount, inMeta]);

  const path = useMemo(() => {
    if (!inMeta) return null;
    return [inMeta.address, addresses.WETH9 as Address];
  }, [inMeta]);

  const quote = useQuote(amountIn, path);

  const minOut = useMemo(() => {
    if (quote.status !== "ready") return null;
    return (quote.amountOut * BigInt(10_000 - props.slipBps)) / 10_000n;
  }, [quote, props.slipBps]);

  const needsApprove = useMemo(() => {
    if (!amountIn || amountIn <= 0n) return false;
    if (allowance === null) return false;
    return allowance < amountIn;
  }, [allowance, amountIn]);

  async function onApprove() {
    if (props.disabled) return;
    if (!props.account) return props.onToast("Connect a wallet first.");
    if (!inMeta) return props.onToast("Enter a valid token address.");

    const walletClient = getWalletClient();
    if (!walletClient) return props.onToast("No injected wallet found (window.ethereum).");

    try {
      const hash = await walletClient.writeContract({
        account: props.account,
        address: inMeta.address,
        abi: ABI.erc20,
        functionName: "approve",
        args: [addresses.UniswapV2Router02 as Address, maxUint256],
      });
      props.onToast(`Approve submitted: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      props.onToast(`Approve confirmed in block ${receipt.blockNumber}`);
    } catch (e) {
      props.onToast(e instanceof Error ? e.message : "Approve failed");
    }
  }

  async function onSwap() {
    if (props.disabled) return;
    if (!props.account) return props.onToast("Connect a wallet first.");
    if (!inMeta) return props.onToast("Enter a valid token address.");
    if (!amountIn || amountIn <= 0n) return props.onToast("Enter a valid token amount.");
    if (!minOut) return props.onToast("Quote not ready yet.");

    const walletClient = getWalletClient();
    if (!walletClient) return props.onToast("No injected wallet found (window.ethereum).");

    try {
      const deadline = nowPlusMinutes(10);
      const hash = await walletClient.writeContract({
        account: props.account,
        address: addresses.UniswapV2Router02 as Address,
        abi: ABI.router,
        functionName: "swapExactTokensForETH",
        args: [amountIn, minOut, [inMeta.address, addresses.WETH9 as Address], props.account, deadline],
      });
      props.onToast(`Swap submitted: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      props.onToast(`Swap confirmed in block ${receipt.blockNumber}`);
    } catch (e) {
      props.onToast(e instanceof Error ? e.message : "Swap failed");
    }
  }

  return (
    <div style={{ display: "grid", gap: 0 }}>
      {/* You pay */}
      <InputPanel label={`You pay${inMeta ? ` (${inMeta.symbol})` : ""}`}>
        <input
          value={tokenInRaw}
          onChange={(e) => setTokenInRaw(e.target.value.trim())}
          placeholder="Token address 0x…"
          style={{ ...inputStyle(), fontSize: 13 }}
        />
        {tokenErr && <div style={{ color: "#ff6b6b", fontSize: 12 }}>{tokenErr}</div>}
        <input
          value={tokenInAmount}
          onChange={(e) => setTokenInAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.0"
          style={amountInputStyle()}
        />
        {props.account && inMeta && tokenBal !== null && (
          <span style={{ fontSize: 12, opacity: 0.45 }}>Balance: {formatAmount(tokenBal, inMeta.decimals)} {inMeta.symbol}</span>
        )}
      </InputPanel>

      <SwapArrow onClick={props.onFlip} />

      {/* You receive */}
      <InputPanel label="You receive">
        <div style={amountDisplayStyle()}>
          {quote.status === "ready" && minOut
            ? `${formatAmount(quote.amountOut, 18)} ETH`
            : quote.status === "loading"
              ? "Fetching…"
              : "—"}
        </div>
        <span style={{ fontSize: 13, opacity: 0.5 }}>ETH</span>
      </InputPanel>

      {/* Approval row */}
      {inMeta && needsApprove && (
        <div style={{
          marginTop: 10,
          padding: "10px 14px",
          borderRadius: 12,
          background: "rgba(255,220,120,0.08)",
          border: "1px solid rgba(255,220,120,0.15)",
          display: "grid",
          gap: 8,
          fontSize: 13,
        }}>
          <div style={{ opacity: 0.85 }}>
            Allowance to Router: <b>{formatAmount(allowance!, inMeta.decimals)} {inMeta.symbol}</b> — approval needed.
          </div>
          <Button onClick={onApprove} disabled={props.disabled} style={{ fontSize: 13, padding: "8px 14px" }}>
            Approve Router
          </Button>
          <div style={{ fontSize: 11, opacity: 0.5 }}>
            Approves <code>uint256.max</code> for convenience.
          </div>
        </div>
      )}

      {/* Quote info */}
      {quote.status === "ready" && minOut && (
        <div style={{ marginTop: 12, display: "grid", gap: 4, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
          <QuoteRow
            label={`1 ${inMeta?.symbol ?? "Token"}`}
            value={`≈ ${amountIn && amountIn > 0n ? formatAmount((quote.amountOut * 10n ** BigInt(inMeta?.decimals ?? 18)) / amountIn, 18) : "—"} ETH`}
          />
          <QuoteRow label={`Min received (${props.slipBps / 100}% slippage)`} value={`${formatAmount(minOut, 18)} ETH`} muted />
        </div>
      )}
      {quote.status === "error" && (
        <div style={{ marginTop: 8, color: "#ff6b6b", fontSize: 13 }}>{quote.error}</div>
      )}

      <div style={{ marginTop: 14 }}>
        {!props.account ? (
          <Button variant="cta" onClick={props.onConnect}>
            Connect Wallet
          </Button>
        ) : (
          <Button
            variant="cta"
            disabled={props.disabled || quote.status !== "ready" || needsApprove}
            onClick={onSwap}
          >
            {needsApprove ? "Approve First" : quote.status === "loading" ? "Fetching quote…" : "Swap"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Contracts footer ─── */

function ContractsFooter() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ textAlign: "center" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.3)",
          cursor: "pointer",
          fontSize: 12,
          fontFamily: "inherit",
        }}
      >
        Contracts {open ? "▲" : "▼"}
      </button>
      {open && (
        <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.35)", display: "grid", gap: 4 }}>
          <div>Router02: <code>{addresses.UniswapV2Router02}</code></div>
          <div>Factory: <code>{addresses.UniswapV2Factory}</code></div>
          <div>WETH: <code>{addresses.WETH9}</code></div>
          <div style={{ opacity: 0.7 }}>
            Quotes: <code>getAmountsOut</code> · Swaps: <code>swapExactETHForTokens</code> / <code>swapExactTokensForETH</code>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Styles ─── */

function inputStyle(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
}

function amountInputStyle(): React.CSSProperties {
  return {
    ...inputStyle(),
    fontSize: 24,
    fontWeight: 500,
    padding: "8px 8px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
  };
}

function amountDisplayStyle(): React.CSSProperties {
  return {
    fontSize: 24,
    fontWeight: 500,
    color: "rgba(255,255,255,0.6)",
    padding: "4px 0",
  };
}
