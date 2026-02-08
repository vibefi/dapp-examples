import { useEffect, useState } from "react";
import { formatEther, type Address } from "viem";
import { DEFAULT_HISTORY_LOOKBACK_BLOCKS } from "../safe";
import type { SafeExecutionHistoryItem } from "../types";
import {
  describeOperation,
  formatBlocks,
  formatErc20Call,
  formatOptionalBlock,
  formatTimestamp,
  formatTokenAmount,
  formatTokenLabel,
  shortAddress,
} from "../utils/format";

type ExecutionHistoryCardProps = {
  overviewLoaded: boolean;
  history: SafeExecutionHistoryItem[];
  historyStartBlock: bigint | null;
  historyEndBlock: bigint | null;
  loading: boolean;
  loadingMoreHistory: boolean;
  activeSafeAddress: Address | null;
  hasMoreHistory: boolean;
  onFetchMoreHistory: () => void;
};

export function ExecutionHistoryCard({
  overviewLoaded,
  history,
  historyStartBlock,
  historyEndBlock,
  loading,
  loadingMoreHistory,
  activeSafeAddress,
  hasMoreHistory,
  onFetchMoreHistory,
}: ExecutionHistoryCardProps) {
  const [expandedLogsByTxHash, setExpandedLogsByTxHash] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedLogsByTxHash({});
  }, [activeSafeAddress]);

  function onToggleLogs(transactionHash: string) {
    setExpandedLogsByTxHash((current) => ({
      ...current,
      [transactionHash]: !current[transactionHash],
    }));
  }

  return (
    <section className="card">
      <h2>Execution History</h2>
      {overviewLoaded ? (
        <div className="historyToolbar">
          <p className="muted">
            Showing block window {formatOptionalBlock(historyStartBlock)} - {formatOptionalBlock(historyEndBlock)}.
            Click fetch to load the previous {formatBlocks(DEFAULT_HISTORY_LOOKBACK_BLOCKS)} blocks.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={onFetchMoreHistory}
            disabled={loading || loadingMoreHistory || !activeSafeAddress || !hasMoreHistory}
          >
            {loadingMoreHistory ? "Fetching previous..." : hasMoreHistory ? "Fetch previous 250k blocks" : "Reached genesis"}
          </button>
        </div>
      ) : null}

      {!overviewLoaded ? (
        <p className="muted">History appears after loading a Safe.</p>
      ) : history.length === 0 ? (
        <p className="muted">No executions found in the current block window.</p>
      ) : (
        <ul className="historyList">
          {history.map((item) => {
            const decoded = item.decodedExecTransaction;
            const logsExpanded = expandedLogsByTxHash[item.transactionHash] ?? false;
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

                <button type="button" className="secondary logToggle" onClick={() => onToggleLogs(item.transactionHash)}>
                  {logsExpanded ? "Hide all transaction logs" : `Show all transaction logs (${item.allLogs.length})`}
                </button>

                {logsExpanded ? (
                  item.allLogs.length === 0 ? (
                    <p className="muted">No logs in transaction receipt.</p>
                  ) : (
                    <ul className="list compactList logList">
                      {item.allLogs.map((log) => (
                        <li key={`${item.transactionHash}-log-${log.logIndex}-${log.address}`} className="logItem">
                          <div className="kvs compact">
                            <div>Index</div>
                            <div>{log.logIndex}</div>
                            <div>Emitter</div>
                            <div>{log.address}</div>
                            <div>Decoded</div>
                            <div>{log.decodedEvent ?? "un-decoded"}</div>
                            <div>Topics</div>
                            <div>{log.topics.length > 0 ? log.topics.join(", ") : "none"}</div>
                            <div>Data</div>
                            <div>{log.data}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
