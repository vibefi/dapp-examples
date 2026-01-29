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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(1000px 600px at 20% 0%, rgba(255,105,180,0.18), transparent), #0b0b10",
        color: "white",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 20, display: "grid", gap: 16 }}>
        <Header
          account={account}
          chainId={chainId}
          ethBalance={ethBalance}
          onConnect={onConnect}
          onSwitchMainnet={onSwitchMainnet}
        />

        {!hasRpcUrl() ? (
          <Card title="Missing RPC_URL">
            <div style={{ opacity: 0.85 }}>
              This app expects an Ethereum JSON-RPC endpoint in <code>RPC_URL</code> (or <code>VITE_RPC_URL</code>).
              Reads and quotes use that RPC. Wallet writes use <code>window.ethereum</code>.
            </div>
          </Card>
        ) : null}

        <Card
          title="Uniswap V2 Swap"
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant={tab === "ethToToken" ? "primary" : "ghost"} onClick={() => setTab("ethToToken")}>
                ETH → Token
              </Button>
              <Button variant={tab === "tokenToEth" ? "primary" : "ghost"} onClick={() => setTab("tokenToEth")}>
                Token → ETH
              </Button>
            </div>
          }
        >
          {needsMainnet ? (
            <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,220,120,0.12)", border: "1px solid rgba(255,220,120,0.25)" }}>
              Connected to chainId <b>{chainId}</b>. This app is for <b>Ethereum mainnet (1)</b>. Switch networks to continue.
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 16 }}>
            <Field
              label="Slippage (basis points)"
              hint="50 = 0.50%, 100 = 1.00%"
            >
              <input
                value={slippageBps}
                onChange={(e) => setSlippageBps(e.target.value)}
                inputMode="numeric"
                style={inputStyle()}
                placeholder="50"
              />
            </Field>

            {tab === "ethToToken" ? (
              <EthToToken
                account={account}
                disabled={!account || needsMainnet}
                slipBps={slip}
                onToast={setToast}
              />
            ) : (
              <TokenToEth
                account={account}
                disabled={!account || needsMainnet}
                slipBps={slip}
                onToast={setToast}
              />
            )}
          </div>
        </Card>

        <Card title="Contracts">
          <div style={{ display: "grid", gap: 8, opacity: 0.9 }}>
            <div>Router02: <code>{addresses.UniswapV2Router02}</code></div>
            <div>Factory: <code>{addresses.UniswapV2Factory}</code></div>
            <div>WETH: <code>{addresses.WETH9}</code></div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Quotes use <code>getAmountsOut</code>. Swaps use <code>swapExactETHForTokens</code> and <code>swapExactTokensForETH</code>.
            </div>
          </div>
        </Card>
      </div>

      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}

function Header(props: {
  account: Address | null;
  chainId: number | null;
  ethBalance: bigint | null;
  onConnect: () => void;
  onSwitchMainnet: () => void;
}) {
  const short = props.account ? `${props.account.slice(0, 6)}…${props.account.slice(-4)}` : null;
  const balance = props.ethBalance !== null ? formatAmount(props.ethBalance, 18, 5) : "—";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <img src="/assets/logo.webp" width={42} height={42} style={{ borderRadius: 12 }} />
        <div style={{ display: "grid" }}>
          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>Uniswap V2 — Mainnet</div>
          <div style={{ opacity: 0.75, fontSize: 12 }}>
            Read RPC: <code>{hasRpcUrl() ? "RPC_URL" : "missing"}</code> · Wallet: <code>window.ethereum</code>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {props.chainId !== null ? (
          <span style={{ opacity: 0.85, fontSize: 12 }}>
            chainId <b>{props.chainId}</b>
          </span>
        ) : null}
        {props.account ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ opacity: 0.9, fontSize: 12 }}>Ξ {balance}</span>
            <span style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)" }}>
              {short}
            </span>
            {props.chainId !== 1 && props.chainId !== null ? (
              <Button onClick={props.onSwitchMainnet}>Switch to Mainnet</Button>
            ) : null}
          </div>
        ) : (
          <Button onClick={props.onConnect}>Connect Wallet</Button>
        )}
      </div>
    </div>
  );
}

function EthToToken(props: { account: Address | null; disabled: boolean; slipBps: number; onToast: (s: string) => void }) {
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
    <div style={{ display: "grid", gap: 14 }}>
      <Field label="Token out (ERC-20 address)" error={tokenErr}>
        <input
          value={tokenOutRaw}
          onChange={(e) => setTokenOutRaw(e.target.value.trim())}
          placeholder="0x…"
          style={inputStyle()}
        />
      </Field>

      <Field label="ETH in" hint={props.account ? "From connected wallet" : undefined}>
        <input
          value={ethIn}
          onChange={(e) => setEthIn(e.target.value)}
          inputMode="decimal"
          placeholder="0.01"
          style={inputStyle()}
        />
      </Field>

      <Card title="Quote">
        {quote.status === "idle" ? (
          <div style={{ opacity: 0.8 }}>Enter token address and amount to quote.</div>
        ) : quote.status === "loading" ? (
          <div style={{ opacity: 0.8 }}>Fetching quote…</div>
        ) : quote.status === "error" ? (
          <div style={{ color: "#ff6b6b" }}>{quote.error}</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            <div>
              Estimated out:{" "}
              <b>
                {outMeta ? formatAmount(quote.amountOut, outMeta.decimals) : quote.amountOut.toString()}{" "}
                {outMeta?.symbol ?? ""}
              </b>
            </div>
            <div style={{ opacity: 0.85 }}>
              Min out (slippage {props.slipBps / 100}%):{" "}
              <b>{outMeta && minOut ? `${formatAmount(minOut, outMeta.decimals)} ${outMeta.symbol}` : "—"}</b>
            </div>
          </div>
        )}
      </Card>

      <Button disabled={props.disabled || quote.status !== "ready"} onClick={onSwap}>
        Swap ETH → {outMeta?.symbol ?? "Token"}
      </Button>

      <div style={{ fontSize: 12, opacity: 0.75 }}>
        This uses Uniswap V2 Router02 <code>swapExactETHForTokens</code>. For ERC-20s that take a fee-on-transfer, you&apos;d typically use the
        fee-supporting variant; this demo uses the standard function.
      </div>
    </div>
  );
}

function TokenToEth(props: { account: Address | null; disabled: boolean; slipBps: number; onToast: (s: string) => void }) {
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
    <div style={{ display: "grid", gap: 14 }}>
      <Field label="Token in (ERC-20 address)" error={tokenErr}>
        <input
          value={tokenInRaw}
          onChange={(e) => setTokenInRaw(e.target.value.trim())}
          placeholder="0x…"
          style={inputStyle()}
        />
      </Field>

      <Field
        label={`Amount in${inMeta ? ` (${inMeta.symbol})` : ""}`}
        hint={props.account && inMeta && tokenBal !== null ? `Balance: ${formatAmount(tokenBal, inMeta.decimals)} ${inMeta.symbol}` : undefined}
      >
        <input
          value={tokenInAmount}
          onChange={(e) => setTokenInAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.0"
          style={inputStyle()}
        />
      </Field>

      <Card title="Approval">
        {!inMeta ? (
          <div style={{ opacity: 0.8 }}>Enter a token address to check allowance.</div>
        ) : allowance === null ? (
          <div style={{ opacity: 0.8 }}>Fetching allowance…</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            <div>
              Allowance to Router: <b>{formatAmount(allowance, inMeta.decimals)} {inMeta.symbol}</b>
            </div>
            {needsApprove ? (
              <div style={{ opacity: 0.85 }}>You need to approve the Router before swapping.</div>
            ) : (
              <div style={{ opacity: 0.85 }}>Allowance is sufficient.</div>
            )}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <Button disabled={props.disabled || !needsApprove} onClick={onApprove}>
            Approve Router
          </Button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
          This approves <code>uint256.max</code> for convenience. Consider approving only what you intend to swap for production apps.
        </div>
      </Card>

      <Card title="Quote">
        {quote.status === "idle" ? (
          <div style={{ opacity: 0.8 }}>Enter amount to quote.</div>
        ) : quote.status === "loading" ? (
          <div style={{ opacity: 0.8 }}>Fetching quote…</div>
        ) : quote.status === "error" ? (
          <div style={{ color: "#ff6b6b" }}>{quote.error}</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            <div>
              Estimated out: <b>{formatAmount(quote.amountOut, 18)} ETH</b>
            </div>
            <div style={{ opacity: 0.85 }}>
              Min out (slippage {props.slipBps / 100}%): <b>{minOut ? `${formatAmount(minOut, 18)} ETH` : "—"}</b>
            </div>
          </div>
        )}
      </Card>

      <Button disabled={props.disabled || quote.status !== "ready" || needsApprove} onClick={onSwap}>
        Swap {inMeta?.symbol ?? "Token"} → ETH
      </Button>

      <div style={{ fontSize: 12, opacity: 0.75 }}>
        This uses Uniswap V2 Router02 <code>swapExactTokensForETH</code> with path <code>[tokenIn, WETH]</code>.
      </div>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
  };
}
