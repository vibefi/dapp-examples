import type { FormEvent } from "react";
import type { Address } from "viem";
import { formatTokenAmount, formatTokenLabel, shortAddress } from "../utils/format";
import type { DetectedTokenBalance } from "../hooks/useTokenBalances";

type TokenBalancesCardProps = {
  trackedTokenCount: number;
  customTokenInput: string;
  onCustomTokenInputChange: (value: string) => void;
  onAddCustomToken: () => void;
  customTrackedTokens: Address[];
  tokenBalanceError: string | null;
  detectedTokenBalances: DetectedTokenBalance[];
  isCheckingTokenBalances: boolean;
  checkedTokenCount: number;
};

export function TokenBalancesCard({
  trackedTokenCount,
  customTokenInput,
  onCustomTokenInputChange,
  onAddCustomToken,
  customTrackedTokens,
  tokenBalanceError,
  detectedTokenBalances,
  isCheckingTokenBalances,
  checkedTokenCount,
}: TokenBalancesCardProps) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddCustomToken();
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
        <p className="muted">Custom tracked: {customTrackedTokens.map((tokenAddress) => shortAddress(tokenAddress)).join(", ")}</p>
      ) : null}
      {tokenBalanceError ? <p className="error">{tokenBalanceError}</p> : null}

      {detectedTokenBalances.length === 0 ? (
        <p className="muted">No non-zero balances detected yet in the tracked token set.</p>
      ) : (
        <ul className="list compactList tokenBalanceList">
          {detectedTokenBalances.map((entry) => (
            <li key={entry.address} className="tokenBalanceItem">
              <div className="tokenBalanceAmount">{formatTokenAmount(entry.balance, entry.token)}</div>
              <div className="tokenBalanceMeta">
                {formatTokenLabel(entry.token)} {entry.isCustomTracked ? "(custom tracked)" : ""}
              </div>
              <div className="tokenBalanceAddress">{entry.address}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
