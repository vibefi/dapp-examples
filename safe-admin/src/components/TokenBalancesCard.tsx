import { type FormEvent, useEffect, useMemo, useState } from "react";
import { encodeFunctionData, erc20Abi, getAddress, isAddress, parseEther, parseUnits, type Address, type Hex } from "viem";
import { formatTokenAmount, formatTokenLabel } from "../utils/format";
import type { DetectedTokenBalance } from "../hooks/useTokenBalances";

type TokenBalancesCardProps = {
  safeAddress: Address | null;
  trackedTokenCount: number;
  customTokenInput: string;
  onCustomTokenInputChange: (value: string) => void;
  onAddCustomToken: () => void;
  customTrackedTokens: Address[];
  tokenBalanceError: string | null;
  detectedTokenBalances: DetectedTokenBalance[];
  isCheckingTokenBalances: boolean;
  checkedTokenCount: number;
  formatAddressShort: (address: Address) => string;
  formatAddressFull: (address: Address) => string;
  onCreateProposal: (draft: {
    title: string;
    description: string | null;
    to: Address;
    value: bigint;
    data: Hex;
    operation: 0 | 1;
  }) => Promise<void>;
};

export function TokenBalancesCard({
  safeAddress,
  trackedTokenCount,
  customTokenInput,
  onCustomTokenInputChange,
  onAddCustomToken,
  customTrackedTokens,
  tokenBalanceError,
  detectedTokenBalances,
  isCheckingTokenBalances,
  checkedTokenCount,
  formatAddressShort,
  formatAddressFull,
  onCreateProposal,
}: TokenBalancesCardProps) {
  const [ethRecipientInput, setEthRecipientInput] = useState("");
  const [ethAmountInput, setEthAmountInput] = useState("");
  const [tokenAddressInput, setTokenAddressInput] = useState("");
  const [tokenRecipientInput, setTokenRecipientInput] = useState("");
  const [tokenAmountInput, setTokenAmountInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uniqueDetectedTokens = useMemo(() => {
    const byAddress = new Map<string, DetectedTokenBalance>();
    for (const entry of detectedTokenBalances) {
      byAddress.set(entry.address.toLowerCase(), entry);
    }
    return [...byAddress.values()];
  }, [detectedTokenBalances]);

  useEffect(() => {
    if (!tokenAddressInput && uniqueDetectedTokens.length > 0) {
      setTokenAddressInput(uniqueDetectedTokens[0].address);
    }
  }, [tokenAddressInput, uniqueDetectedTokens]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddCustomToken();
  }

  async function submitProposal(draft: {
    title: string;
    description: string | null;
    to: Address;
    value: bigint;
    data: Hex;
    operation: 0 | 1;
  }) {
    setIsSubmitting(true);
    try {
      await onCreateProposal(draft);
      setSendError(null);
    } catch (nextError) {
      setSendError(nextError instanceof Error ? nextError.message : "Failed to create transfer proposal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onProposeEthSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!safeAddress) {
      setSendError("Load a Safe on Home before proposing transfers.");
      return;
    }
    if (!isAddress(ethRecipientInput.trim())) {
      setSendError("Enter a valid ETH recipient address.");
      return;
    }
    const to = getAddress(ethRecipientInput.trim()) as Address;
    const trimmedAmount = ethAmountInput.trim();
    if (!trimmedAmount) {
      setSendError("Enter an ETH amount.");
      return;
    }

    let value: bigint;
    try {
      value = parseEther(trimmedAmount);
    } catch {
      setSendError("Invalid ETH amount.");
      return;
    }
    if (value <= 0n) {
      setSendError("ETH amount must be greater than zero.");
      return;
    }

    await submitProposal({
      title: "Send ETH",
      description: `Send ${trimmedAmount} ETH to ${to}.`,
      to,
      value,
      data: "0x",
      operation: 0,
    });
    setEthRecipientInput("");
    setEthAmountInput("");
  }

  async function onProposeTokenSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!safeAddress) {
      setSendError("Load a Safe on Home before proposing transfers.");
      return;
    }
    if (!isAddress(tokenAddressInput)) {
      setSendError("Select a token contract.");
      return;
    }
    if (!isAddress(tokenRecipientInput.trim())) {
      setSendError("Enter a valid token recipient address.");
      return;
    }
    const token = uniqueDetectedTokens.find((entry) => entry.address.toLowerCase() === tokenAddressInput.toLowerCase());
    if (!token) {
      setSendError("Selected token is unavailable.");
      return;
    }
    if (token.token?.decimals === null || token.token?.decimals === undefined) {
      setSendError("Selected token decimals are unavailable.");
      return;
    }

    const recipient = getAddress(tokenRecipientInput.trim()) as Address;
    const trimmedAmount = tokenAmountInput.trim();
    if (!trimmedAmount) {
      setSendError("Enter a token amount.");
      return;
    }

    let amount: bigint;
    try {
      amount = parseUnits(trimmedAmount, token.token.decimals);
    } catch {
      setSendError("Invalid token amount.");
      return;
    }
    if (amount <= 0n) {
      setSendError("Token amount must be greater than zero.");
      return;
    }

    const tokenAddress = getAddress(tokenAddressInput) as Address;
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient, amount],
    });

    await submitProposal({
      title: "Send token",
      description: `Send ${trimmedAmount} ${formatTokenLabel(token.token, formatAddressShort)} to ${recipient}.`,
      to: tokenAddress,
      value: 0n,
      data,
      operation: 0,
    });
    setTokenRecipientInput("");
    setTokenAmountInput("");
  }

  return (
    <section className="card">
      <div className="sectionHead">
        <h2>Token Balances</h2>
        <span className="chip">{trackedTokenCount} tracked</span>
      </div>
      <p className="muted">
        Polling {trackedTokenCount} top ERC20 contracts for balances.
      </p>
      {isCheckingTokenBalances ? (
        <p className="muted" role="status" aria-live="polite">
          Checking token balances: {checkedTokenCount}/{trackedTokenCount}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="form tokenAddForm">
        <label htmlFor="customTokenAddress">Add custom token contract</label>
        <div className="row">
          <input
            id="customTokenAddress"
            value={customTokenInput}
            onChange={(event) => onCustomTokenInputChange(event.target.value)}
            placeholder="0x..."
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="secondary">
            Track token
          </button>
        </div>
      </form>

      {customTrackedTokens.length > 0 ? (
        <p className="muted">Custom tracked: {customTrackedTokens.map((tokenAddress) => formatAddressShort(tokenAddress)).join(", ")}</p>
      ) : null}
      {tokenBalanceError ? <p className="error">{tokenBalanceError}</p> : null}
      {sendError ? <p className="error">{sendError}</p> : null}

      <div className="settingsGrid">
        <section className="card tokenTransferCard">
          <h3>Propose ETH Send</h3>
          <form onSubmit={(event) => void onProposeEthSend(event)} className="form settingsForm">
            <label htmlFor="sendEthRecipient">Recipient</label>
            <input
              id="sendEthRecipient"
              value={ethRecipientInput}
              onChange={(event) => setEthRecipientInput(event.target.value)}
              placeholder="0x..."
              autoComplete="off"
              spellCheck={false}
            />
            <label htmlFor="sendEthAmount">Amount (ETH)</label>
            <div className="row">
              <input
                id="sendEthAmount"
                value={ethAmountInput}
                onChange={(event) => setEthAmountInput(event.target.value)}
                placeholder="0.1"
                inputMode="decimal"
              />
              <button type="submit" disabled={isSubmitting}>
                Propose ETH tx
              </button>
            </div>
          </form>
        </section>

        <section className="card tokenTransferCard">
          <h3>Propose Token Send</h3>
          <form onSubmit={(event) => void onProposeTokenSend(event)} className="form settingsForm">
            <label htmlFor="sendTokenContract">Token</label>
            <select
              id="sendTokenContract"
              value={tokenAddressInput}
              onChange={(event) => setTokenAddressInput(event.target.value)}
            >
              {uniqueDetectedTokens.length === 0 ? <option value="">No token balances</option> : null}
              {uniqueDetectedTokens.map((entry) => (
                <option key={entry.address} value={entry.address}>
                  {formatTokenLabel(entry.token, formatAddressShort)} ({formatAddressShort(entry.address)})
                </option>
              ))}
            </select>
            <label htmlFor="sendTokenRecipient">Recipient</label>
            <input
              id="sendTokenRecipient"
              value={tokenRecipientInput}
              onChange={(event) => setTokenRecipientInput(event.target.value)}
              placeholder="0x..."
              autoComplete="off"
              spellCheck={false}
            />
            <label htmlFor="sendTokenAmount">Amount</label>
            <div className="row">
              <input
                id="sendTokenAmount"
                value={tokenAmountInput}
                onChange={(event) => setTokenAmountInput(event.target.value)}
                placeholder="0.0"
                inputMode="decimal"
              />
              <button type="submit" disabled={isSubmitting || uniqueDetectedTokens.length === 0}>
                Propose token tx
              </button>
            </div>
          </form>
        </section>
      </div>

      {detectedTokenBalances.length === 0 ? (
        <p className="muted">No non-zero balances detected yet in the tracked token set.</p>
      ) : (
        <ul className="list compactList tokenBalanceList">
          {detectedTokenBalances.map((entry) => (
            <li key={entry.address} className="tokenBalanceItem">
              <div className="tokenBalanceAmount">{formatTokenAmount(entry.balance, entry.token)}</div>
              <div className="tokenBalanceMeta">
                {formatTokenLabel(entry.token, formatAddressShort)} {entry.isCustomTracked ? "(custom tracked)" : ""}
              </div>
              <div className="tokenBalanceAddress">{formatAddressFull(entry.address)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
