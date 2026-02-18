import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Address } from "viem";
import { maxUint256, parseEther } from "viem";
import {
  useAccount,
  useBalance,
  useConnect,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { mainnet } from "wagmi/chains";
import { ABI } from "./abis";
import { addresses, MAINNET_CHAIN_ID } from "./addresses";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { Toast } from "./components/Toast";
import { useAllowance } from "./hooks/useAllowance";
import { useErc20Balance } from "./hooks/useErc20Balance";
import { useQuote } from "./hooks/useQuote";
import { useTokenMeta } from "./hooks/useTokenMeta";
import { formatAmount, nowPlusMinutes, safeParseUnits } from "./utils";
import logoUrl from "../assets/logo.webp";

type Tab = "ethToToken" | "tokenToEth";

export default function App() {
  const { address, chainId, isConnected } = useAccount();
  const { connect } = useConnect();
  const { switchChain } = useSwitchChain();
  const { data: ethBalanceData } = useBalance({
    address,
    query: { enabled: Boolean(isConnected && address) },
  });

  const [tab, setTab] = useState<Tab>("ethToToken");
  const [toast, setToast] = useState<string | null>(null);
  const [slippageBps, setSlippageBps] = useState<string>("50");
  const [slippageOpen, setSlippageOpen] = useState(false);

  const slip = useMemo(() => {
    const n = Number(slippageBps);
    if (!Number.isFinite(n) || n < 0) return 50;
    if (n > 2_000) return 2_000;
    return Math.floor(n);
  }, [slippageBps]);

  const account = address ?? null;
  const needsMainnet = chainId !== undefined && chainId !== MAINNET_CHAIN_ID;
  const ethBalance = ethBalanceData?.value ?? null;

  function onConnect() {
    connect({ connector: injected() });
  }

  function onSwitchMainnet() {
    switchChain({ chainId: mainnet.id });
  }

  function toggleTab() {
    setTab((t) => (t === "ethToToken" ? "tokenToEth" : "ethToToken"));
  }

  return (
    <div className="appRoot">
      <div className="contentWrap">
        <Header
          account={account}
          chainId={chainId ?? null}
          ethBalance={ethBalance}
          onConnect={onConnect}
          onSwitchMainnet={onSwitchMainnet}
        />

        <div className="contentArea">
          <Card>
            {/* Title + Slippage row */}
            <div className="swapHeader">
              <div className="swapTitle">Swap</div>
              <button
                onClick={() => setSlippageOpen((o) => !o)}
                className="slippageBtn"
              >
                <span>&#9881;</span>
                {(slip / 100).toFixed(2)}%
              </button>
            </div>

            {slippageOpen && (
              <div className="slippagePanel">
                <span className="slippageLabel">Slippage (bps):</span>
                <input
                  value={slippageBps}
                  onChange={(e) => setSlippageBps(e.target.value)}
                  inputMode="numeric"
                  placeholder="50"
                  className="input slippageInput"
                />
                <span className="slippageHint">50 = 0.50%</span>
              </div>
            )}

            {/* Pill tabs */}
            <div className="tabRow">
              <TabPill active={tab === "ethToToken"} onClick={() => setTab("ethToToken")}>
                ETH &rarr; Token
              </TabPill>
              <TabPill active={tab === "tokenToEth"} onClick={() => setTab("tokenToEth")}>
                Token &rarr; ETH
              </TabPill>
            </div>

            {needsMainnet ? (
              <div className="networkWarn">
                Connected to chainId <b>{chainId}</b>. This app is for{" "}
                <b>Ethereum mainnet (1)</b>. Switch networks to continue.
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
          <div className="contractsFooterWrap">
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
    <div className="header">
      <div className="headerLeft">
        <img src={logoUrl} width={32} height={32} className="headerLogo" alt="" />
        <span className="headerTitle">Uniswap V2</span>
      </div>

      <div className="headerRight">
        {props.account ? (
          <>
            {props.chainId !== null && props.chainId !== 1 && (
              <Button variant="ghost" onClick={props.onSwitchMainnet} className="sm">
                Switch to Mainnet
              </Button>
            )}
            <div className="accountBadge">
              {balance !== null && <span className="accountBalance">{balance} ETH</span>}
              <span className="accountAddress">
                {props.chainId !== null && (
                  <span className={`chainDot ${props.chainId === 1 ? "mainnet" : "other"}`} />
                )}
                {short}
              </span>
            </div>
          </>
        ) : (
          <Button onClick={props.onConnect} className="pill">
            Connect Wallet
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Tab pill ─── */

function TabPill(props: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={props.onClick} className={`tabPill${props.active ? " active" : ""}`}>
      {props.children}
    </button>
  );
}

/* ─── Swap direction arrow ─── */

function SwapArrow(props: { onClick: () => void }) {
  return (
    <div className="swapArrowWrap">
      <button onClick={props.onClick} className="swapArrowBtn" title="Switch direction">
        ↓
      </button>
    </div>
  );
}

/* ─── Input panel wrapper ─── */

function InputPanel(props: { label: string; children: ReactNode }) {
  return (
    <div className="inputPanel">
      <span className="inputPanelLabel">{props.label}</span>
      {props.children}
    </div>
  );
}

/* ─── Inline quote row ─── */

function QuoteRow(props: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`quoteRow${props.muted ? " muted" : ""}`}>
      <span>{props.label}</span>
      <span>{props.value}</span>
    </div>
  );
}

/* ─── ETH → Token ─── */

function EthToToken(props: {
  account: Address | null;
  disabled: boolean;
  slipBps: number;
  onToast: (s: string) => void;
  onFlip: () => void;
  onConnect: () => void;
}) {
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

  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient();

  async function onSwap() {
    if (props.disabled) return;
    if (!props.account) return props.onToast("Connect a wallet first.");
    if (!outMeta) return props.onToast("Enter a valid token address.");
    if (!amountIn || amountIn <= 0n) return props.onToast("Enter a valid ETH amount.");
    if (!minOut) return props.onToast("Quote not ready yet.");

    try {
      const deadline = nowPlusMinutes(10);
      const hash = await writeContractAsync({
        address: addresses.UniswapV2Router02 as Address,
        abi: ABI.router,
        functionName: "swapExactETHForTokens",
        args: [minOut, [addresses.WETH9 as Address, outMeta.address], props.account, deadline],
        value: amountIn,
      });
      props.onToast(`Swap submitted: ${hash}`);
      const receipt = await client!.waitForTransactionReceipt({ hash });
      props.onToast(`Swap confirmed in block ${receipt.blockNumber}`);
    } catch (e) {
      props.onToast(e instanceof Error ? e.message : "Swap failed");
    }
  }

  return (
    <div className="swapPanel">
      {/* You pay */}
      <InputPanel label="You pay">
        <input
          value={ethIn}
          onChange={(e) => setEthIn(e.target.value)}
          inputMode="decimal"
          placeholder="0.0"
          className="amountInput"
        />
        <span className="tokenLabel">ETH</span>
      </InputPanel>

      <SwapArrow onClick={props.onFlip} />

      {/* You receive */}
      <InputPanel label="You receive">
        <input
          value={tokenOutRaw}
          onChange={(e) => setTokenOutRaw(e.target.value.trim())}
          placeholder="Token address 0x…"
          className="input"
        />
        {tokenErr && <div className="tokenError">{tokenErr}</div>}
        <div className="amountDisplay">
          {quote.status === "ready" && outMeta
            ? `${formatAmount(quote.amountOut, outMeta.decimals)} ${outMeta.symbol}`
            : quote.status === "loading"
              ? "Fetching…"
              : "—"}
        </div>
      </InputPanel>

      {/* Quote info */}
      {quote.status === "ready" && outMeta && minOut && (
        <div className="quoteInfo">
          <QuoteRow
            label="1 ETH"
            value={`≈ ${amountIn && amountIn > 0n ? formatAmount((quote.amountOut * parseEther("1")) / amountIn, outMeta.decimals) : "—"} ${outMeta.symbol}`}
          />
          <QuoteRow
            label={`Min received (${props.slipBps / 100}% slippage)`}
            value={`${formatAmount(minOut, outMeta.decimals)} ${outMeta.symbol}`}
            muted
          />
        </div>
      )}
      {quote.status === "error" && <div className="quoteError">{quote.error}</div>}

      <div className="swapAction">
        {!props.account ? (
          <Button variant="cta" onClick={props.onConnect}>
            Connect Wallet
          </Button>
        ) : (
          <Button
            variant="cta"
            disabled={props.disabled || quote.status !== "ready"}
            onClick={onSwap}
          >
            {quote.status === "loading" ? "Fetching quote…" : "Swap"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Token → ETH ─── */

function TokenToEth(props: {
  account: Address | null;
  disabled: boolean;
  slipBps: number;
  onToast: (s: string) => void;
  onFlip: () => void;
  onConnect: () => void;
}) {
  const [tokenInRaw, setTokenInRaw] = useState<string>("");
  const [tokenInAmount, setTokenInAmount] = useState<string>("");

  const { meta: inMeta, error: tokenErr } = useTokenMeta(tokenInRaw, "token");

  const tokenBal = useErc20Balance(inMeta?.address, props.account ?? undefined);
  const allowance = useAllowance(
    inMeta?.address,
    props.account ?? undefined,
    addresses.UniswapV2Router02 as Address
  );

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

  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient();

  async function onApprove() {
    if (props.disabled) return;
    if (!props.account) return props.onToast("Connect a wallet first.");
    if (!inMeta) return props.onToast("Enter a valid token address.");

    try {
      const hash = await writeContractAsync({
        address: inMeta.address,
        abi: ABI.erc20,
        functionName: "approve",
        args: [addresses.UniswapV2Router02 as Address, maxUint256],
      });
      props.onToast(`Approve submitted: ${hash}`);
      const receipt = await client!.waitForTransactionReceipt({ hash });
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

    try {
      const deadline = nowPlusMinutes(10);
      const hash = await writeContractAsync({
        address: addresses.UniswapV2Router02 as Address,
        abi: ABI.router,
        functionName: "swapExactTokensForETH",
        args: [amountIn, minOut, [inMeta.address, addresses.WETH9 as Address], props.account, deadline],
      });
      props.onToast(`Swap submitted: ${hash}`);
      const receipt = await client!.waitForTransactionReceipt({ hash });
      props.onToast(`Swap confirmed in block ${receipt.blockNumber}`);
    } catch (e) {
      props.onToast(e instanceof Error ? e.message : "Swap failed");
    }
  }

  return (
    <div className="swapPanel">
      {/* You pay */}
      <InputPanel label={`You pay${inMeta ? ` (${inMeta.symbol})` : ""}`}>
        <input
          value={tokenInRaw}
          onChange={(e) => setTokenInRaw(e.target.value.trim())}
          placeholder="Token address 0x…"
          className="input"
        />
        {tokenErr && <div className="tokenError">{tokenErr}</div>}
        <input
          value={tokenInAmount}
          onChange={(e) => setTokenInAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.0"
          className="amountInput"
        />
        {props.account && inMeta && tokenBal !== null && (
          <span className="balanceHint">
            Balance: {formatAmount(tokenBal, inMeta.decimals)} {inMeta.symbol}
          </span>
        )}
      </InputPanel>

      <SwapArrow onClick={props.onFlip} />

      {/* You receive */}
      <InputPanel label="You receive">
        <div className="amountDisplay">
          {quote.status === "ready" && minOut
            ? `${formatAmount(quote.amountOut, 18)} ETH`
            : quote.status === "loading"
              ? "Fetching…"
              : "—"}
        </div>
        <span className="tokenLabel">ETH</span>
      </InputPanel>

      {/* Approval row */}
      {inMeta && needsApprove && (
        <div className="approvalBox">
          <div>
            Allowance to Router:{" "}
            <b>
              {formatAmount(allowance!, inMeta.decimals)} {inMeta.symbol}
            </b>{" "}
            — approval needed.
          </div>
          <Button onClick={onApprove} disabled={props.disabled} className="sm">
            Approve Router
          </Button>
          <div className="approvalBoxHint">
            Approves <code>uint256.max</code> for convenience.
          </div>
        </div>
      )}

      {/* Quote info */}
      {quote.status === "ready" && minOut && (
        <div className="quoteInfo">
          <QuoteRow
            label={`1 ${inMeta?.symbol ?? "Token"}`}
            value={`≈ ${amountIn && amountIn > 0n ? formatAmount((quote.amountOut * 10n ** BigInt(inMeta?.decimals ?? 18)) / amountIn, 18) : "—"} ETH`}
          />
          <QuoteRow
            label={`Min received (${props.slipBps / 100}% slippage)`}
            value={`${formatAmount(minOut, 18)} ETH`}
            muted
          />
        </div>
      )}
      {quote.status === "error" && <div className="quoteError">{quote.error}</div>}

      <div className="swapAction">
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
    <div className="contractsFooter">
      <button onClick={() => setOpen((o) => !o)} className="contractsToggleBtn">
        Contracts {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="contractsList">
          <div>
            Router02: <code>{addresses.UniswapV2Router02}</code>
          </div>
          <div>
            Factory: <code>{addresses.UniswapV2Factory}</code>
          </div>
          <div>
            WETH: <code>{addresses.WETH9}</code>
          </div>
          <div className="contractsDisclaimer">
            Quotes: <code>getAmountsOut</code> · Swaps: <code>swapExactETHForTokens</code> /{" "}
            <code>swapExactTokensForETH</code>
          </div>
        </div>
      )}
    </div>
  );
}
