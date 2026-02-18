import { useMemo, useState } from "react";
import { type Address, type Hex } from "viem";
import { usePublicClient, useSignTypedData, useWriteContract } from "wagmi";
import { ABI } from "../abis";
import type { SafeOverview, SafeProposedTransaction, SafeProposalSignature, SharedSafeProposalPayload } from "../types";
import { formatEtherDisplay, formatTimestamp } from "../utils/format";
import {
  buildSafeTxTypedData,
  buildSignatureBytes,
  countOwnerSignatures,
  isSignatureValidForOwner,
  normalizeEcdsaSignature,
  toSharedProposalPayload,
} from "../utils/proposals";

type ProposedTransactionsCardProps = {
  overview: SafeOverview | null;
  walletAccount: Address | null;
  isConnected: boolean;
  proposals: SafeProposedTransaction[];
  formatAddressFull: (address: Address) => string;
  onAddSignature: (safeTxHash: Hex, signature: SafeProposalSignature) => void;
  onMarkExecuted: (safeTxHash: Hex, txHash: Hex) => void;
  onRemoveProposal: (safeTxHash: Hex) => void;
  onImportSharedPayload: (payload: SharedSafeProposalPayload) => Promise<void>;
};

export function ProposedTransactionsCard({
  overview,
  walletAccount,
  isConnected,
  proposals,
  formatAddressFull,
  onAddSignature,
  onMarkExecuted,
  onRemoveProposal,
  onImportSharedPayload,
}: ProposedTransactionsCardProps) {
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const [importJsonInput, setImportJsonInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busySafeTxHash, setBusySafeTxHash] = useState<Hex | null>(null);

  const sortedProposals = useMemo(() => {
    return [...proposals].sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [proposals]);

  const activeOwners = overview?.owners ?? [];
  const threshold = overview?.threshold ?? 0;
  const walletIsOwner =
    walletAccount !== null && activeOwners.some((owner) => owner.toLowerCase() === walletAccount.toLowerCase());

  async function onSignProposal(proposal: SafeProposedTransaction) {
    if (!walletAccount) {
      setError("Connect wallet to sign.");
      return;
    }
    if (!walletIsOwner) {
      setError("Connected wallet is not a signer for the loaded Safe.");
      return;
    }
    if (!isConnected) {
      setError("Wallet is not connected.");
      return;
    }

    setBusySafeTxHash(proposal.safeTxHash);
    setError(null);
    setNotice(null);
    try {
      const typedData = buildSafeTxTypedData(proposal.safeAddress, proposal.chainId, proposal.tx);
      const signatureRaw = (await signTypedDataAsync(typedData)) as Hex;
      const signature = normalizeEcdsaSignature(signatureRaw);
      if (!signature) throw new Error("Wallet returned an invalid signature format.");

      const valid = await isSignatureValidForOwner(proposal.safeTxHash, walletAccount, signature);
      if (!valid) {
        throw new Error("Signature does not match connected wallet address.");
      }

      onAddSignature(proposal.safeTxHash, { owner: walletAccount, signature });
      setNotice("Signature added to proposal.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to sign transaction.");
    } finally {
      setBusySafeTxHash(null);
    }
  }

  async function onCopyProposal(proposal: SafeProposedTransaction) {
    if (!walletAccount || !isConnected) {
      setError("Connect wallet to copy signed proposal JSON.");
      return;
    }

    const walletSigned = proposal.signatures.some((entry) => entry.owner.toLowerCase() === walletAccount.toLowerCase());
    if (!walletSigned) {
      setError("Sign this proposal first so exported JSON includes your signature.");
      return;
    }

    const payload = toSharedProposalPayload(proposal);
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setNotice("Proposal JSON copied to clipboard.");
      setError(null);
    } catch {
      setError("Failed to copy proposal JSON.");
    }
  }

  async function onImportPayload() {
    setNotice(null);
    setError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(importJsonInput);
    } catch {
      setError("Invalid JSON.");
      return;
    }

    const payloads = Array.isArray(parsed) ? parsed : [parsed];
    if (payloads.length === 0) {
      setError("No proposal payload found.");
      return;
    }

    let importedCount = 0;
    for (const payload of payloads) {
      try {
        await onImportSharedPayload(payload as SharedSafeProposalPayload);
        importedCount += 1;
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : "Failed to import payload.";
        setError(message);
        return;
      }
    }

    setNotice(`Imported ${importedCount} proposal payload${importedCount === 1 ? "" : "s"}.`);
    setImportJsonInput("");
  }

  async function onExecuteProposal(proposal: SafeProposedTransaction) {
    if (!overview) {
      setError("Load a Safe on Home before execution.");
      return;
    }
    if (!publicClient) {
      setError("No public client available.");
      return;
    }
    if (!isConnected) {
      setError("Connect wallet to execute.");
      return;
    }

    const signatureCount = countOwnerSignatures(proposal, overview.owners);
    if (signatureCount < overview.threshold) {
      setError("Not enough signatures to execute.");
      return;
    }

    const signatures = buildSignatureBytes(proposal, overview.owners);
    setBusySafeTxHash(proposal.safeTxHash);
    setError(null);
    setNotice(null);

    try {
      const hash = await writeContractAsync({
        address: proposal.safeAddress,
        abi: ABI.safe,
        functionName: "execTransaction",
        args: [
          proposal.tx.to,
          proposal.tx.value,
          proposal.tx.data,
          proposal.tx.operation,
          proposal.tx.safeTxGas,
          proposal.tx.baseGas,
          proposal.tx.gasPrice,
          proposal.tx.gasToken,
          proposal.tx.refundReceiver,
          signatures,
        ],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("Execution transaction reverted.");
      }

      onMarkExecuted(proposal.safeTxHash, hash);
      setNotice(`Executed proposal in tx ${hash}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to execute proposal.");
    } finally {
      setBusySafeTxHash(null);
    }
  }

  return (
    <>
      <section className="card">
        <div className="sectionHead">
          <h2>Proposed Transactions</h2>
          <span className="chip">{sortedProposals.length} total</span>
        </div>
        <p className="muted">
          Sign proposals, share/import partial signatures as JSON, and execute once signatures reach the Safe threshold.
        </p>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <div className="noticeBanner">{notice}</div> : null}

      <section className="card">
        <h3>Import Partial Signature JSON</h3>
        <p className="muted">Paste a shared proposal payload from another signer.</p>
        <div className="form settingsForm">
          <textarea
            className="importTextarea"
            value={importJsonInput}
            onChange={(event) => setImportJsonInput(event.target.value)}
            placeholder='{"version":1,...}'
            spellCheck={false}
          />
          <button type="button" onClick={() => void onImportPayload()}>
            Import proposal JSON
          </button>
        </div>
      </section>

      <section className="card">
        {sortedProposals.length === 0 ? (
          <p className="muted">No proposals in this session yet.</p>
        ) : (
          <ul className="settingsProposalList">
            {sortedProposals.map((proposal) => {
              const signatureCount = countOwnerSignatures(proposal, activeOwners);
              const enoughSignatures = threshold > 0 && signatureCount >= threshold;
              const walletAlreadySigned =
                walletAccount !== null &&
                proposal.signatures.some((entry) => entry.owner.toLowerCase() === walletAccount.toLowerCase());
              const isBusy = busySafeTxHash === proposal.safeTxHash;

              return (
                <li key={proposal.safeTxHash} className="settingsProposalItem">
                  <div className="settingsProposalHeader">
                    <strong>{proposal.title}</strong>
                    <span className="muted">{formatTimestamp(proposal.createdAtMs)}</span>
                  </div>
                  {proposal.description ? <p className="infoLine">{proposal.description}</p> : null}
                  <div className="kvs compact">
                    <div>Safe</div>
                    <div>{formatAddressFull(proposal.safeAddress)}</div>
                    <div>Nonce</div>
                    <div>{proposal.tx.nonce.toString()}</div>
                    <div>To</div>
                    <div>{formatAddressFull(proposal.tx.to)}</div>
                    <div>Value</div>
                    <div>{formatEtherDisplay(proposal.tx.value)} ETH</div>
                    <div>Safe Tx Hash</div>
                    <div>{proposal.safeTxHash}</div>
                    <div>Signatures</div>
                    <div>
                      {signatureCount}
                      {threshold > 0 ? `/${threshold}` : ""}
                    </div>
                    <div>Executed</div>
                    <div>{proposal.executedTxHash ? proposal.executedTxHash : "no"}</div>
                  </div>

                  <div className="proposalActions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={
                        isBusy ||
                        proposal.executedTxHash !== null ||
                        !walletIsOwner ||
                        walletAlreadySigned ||
                        !isConnected ||
                        !overview
                      }
                      onClick={() => void onSignProposal(proposal)}
                    >
                      {walletAlreadySigned ? "Signed" : "Sign"}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={
                        isBusy ||
                        proposal.executedTxHash !== null ||
                        enoughSignatures ||
                        !isConnected ||
                        !walletAlreadySigned
                      }
                      onClick={() => void onCopyProposal(proposal)}
                    >
                      Copy partial JSON
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={
                        isBusy ||
                        proposal.executedTxHash !== null ||
                        !overview ||
                        proposal.safeAddress.toLowerCase() !== overview.safeAddress.toLowerCase() ||
                        !enoughSignatures
                      }
                      onClick={() => void onExecuteProposal(proposal)}
                    >
                      Execute
                    </button>
                    <button type="button" className="secondary" onClick={() => onRemoveProposal(proposal.safeTxHash)}>
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
