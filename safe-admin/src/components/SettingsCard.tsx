import { type FormEvent, useEffect, useState } from "react";
import { encodeFunctionData, getAddress, isAddress, type Address, type Hex } from "viem";
import { ABI } from "../abis";
import type { SafeOverview } from "../types";

const SENTINEL_OWNERS = "0x0000000000000000000000000000000000000001" as const;

type SettingsCardProps = {
  overview: SafeOverview | null;
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

function parseThreshold(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function SettingsCard({ overview, formatAddressFull, onCreateProposal }: SettingsCardProps) {
  const [error, setError] = useState<string | null>(null);
  const [addOwnerInput, setAddOwnerInput] = useState("");
  const [addThresholdInput, setAddThresholdInput] = useState("");
  const [removeOwnerInput, setRemoveOwnerInput] = useState("");
  const [removeThresholdInput, setRemoveThresholdInput] = useState("");
  const [changeThresholdInput, setChangeThresholdInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!overview) {
      setAddOwnerInput("");
      setAddThresholdInput("");
      setRemoveOwnerInput("");
      setRemoveThresholdInput("");
      setChangeThresholdInput("");
      setError(null);
      return;
    }

    setAddThresholdInput(String(overview.threshold));
    setRemoveOwnerInput(overview.owners[0] ?? "");
    const nextRemoveThreshold = Math.max(1, Math.min(overview.threshold, Math.max(1, overview.owners.length - 1)));
    setRemoveThresholdInput(String(nextRemoveThreshold));
    setChangeThresholdInput(String(overview.threshold));
    setError(null);
  }, [overview]);

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
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to create proposal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onProposeAddOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!overview) {
      setError("Load a Safe on Home before creating admin proposals.");
      return;
    }

    if (!isAddress(addOwnerInput.trim())) {
      setError("Enter a valid signer address to add.");
      return;
    }
    const owner = getAddress(addOwnerInput.trim()) as Address;
    if (overview.owners.some((currentOwner) => currentOwner.toLowerCase() === owner.toLowerCase())) {
      setError("That address is already a signer.");
      return;
    }

    const nextThreshold = parseThreshold(addThresholdInput);
    if (nextThreshold === null) {
      setError("Add signer threshold must be a positive integer.");
      return;
    }
    if (nextThreshold > overview.owners.length + 1) {
      setError("Threshold cannot exceed the new signer count.");
      return;
    }

    const data = encodeFunctionData({
      abi: ABI.safe,
      functionName: "addOwnerWithThreshold",
      args: [owner, BigInt(nextThreshold)],
    });

    await submitProposal({
      title: "Add signer",
      description: `Add signer ${owner} and set threshold to ${nextThreshold}.`,
      to: overview.safeAddress,
      value: 0n,
      data,
      operation: 0,
    });
    setAddOwnerInput("");
  }

  async function onProposeRemoveOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!overview) {
      setError("Load a Safe on Home before creating admin proposals.");
      return;
    }
    if (overview.owners.length <= 1) {
      setError("Cannot remove signer when there is only one owner.");
      return;
    }
    if (!isAddress(removeOwnerInput)) {
      setError("Select a signer to remove.");
      return;
    }

    const owner = getAddress(removeOwnerInput) as Address;
    const ownerIndex = overview.owners.findIndex((currentOwner) => currentOwner.toLowerCase() === owner.toLowerCase());
    if (ownerIndex < 0) {
      setError("Selected signer is not an owner of this Safe.");
      return;
    }

    const nextThreshold = parseThreshold(removeThresholdInput);
    if (nextThreshold === null) {
      setError("Remove signer threshold must be a positive integer.");
      return;
    }
    if (nextThreshold > overview.owners.length - 1) {
      setError("Threshold cannot exceed remaining signer count.");
      return;
    }

    const prevOwner = ownerIndex === 0 ? (SENTINEL_OWNERS as Address) : overview.owners[ownerIndex - 1];
    const data = encodeFunctionData({
      abi: ABI.safe,
      functionName: "removeOwner",
      args: [prevOwner, owner, BigInt(nextThreshold)],
    });

    await submitProposal({
      title: "Remove signer",
      description: `Remove signer ${owner}, prevOwner ${prevOwner}, threshold ${nextThreshold}.`,
      to: overview.safeAddress,
      value: 0n,
      data,
      operation: 0,
    });
  }

  async function onProposeChangeThreshold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!overview) {
      setError("Load a Safe on Home before creating admin proposals.");
      return;
    }

    const nextThreshold = parseThreshold(changeThresholdInput);
    if (nextThreshold === null) {
      setError("Threshold must be a positive integer.");
      return;
    }
    if (nextThreshold > overview.owners.length) {
      setError("Threshold cannot exceed current signer count.");
      return;
    }
    if (nextThreshold === overview.threshold) {
      setError("Threshold is already set to that value.");
      return;
    }

    const data = encodeFunctionData({
      abi: ABI.safe,
      functionName: "changeThreshold",
      args: [BigInt(nextThreshold)],
    });

    await submitProposal({
      title: "Change confirmations",
      description: `Change required confirmations to ${nextThreshold}.`,
      to: overview.safeAddress,
      value: 0n,
      data,
      operation: 0,
    });
  }

  if (!overview) {
    return (
      <section className="card">
        <h2>Settings</h2>
        <p className="muted">Load a Safe on Home, then return here to propose signer and threshold transactions.</p>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <div className="sectionHead">
          <h2>Settings</h2>
          <span className="chip">Safe admin proposals</span>
        </div>
        <p className="muted">
          These actions create Safe transaction payloads targeting {formatAddressFull(overview.safeAddress)}.
        </p>
      </section>

      <div className="settingsGrid">
        <section className="card">
          <h3>Add Signer</h3>
          <form onSubmit={(event) => void onProposeAddOwner(event)} className="form settingsForm">
            <label htmlFor="addOwnerAddress">Signer address</label>
            <input
              id="addOwnerAddress"
              value={addOwnerInput}
              onChange={(event) => setAddOwnerInput(event.target.value)}
              placeholder="0x..."
              autoComplete="off"
              spellCheck={false}
            />
            <label htmlFor="addOwnerThreshold">New required confirmations</label>
            <div className="row">
              <input
                id="addOwnerThreshold"
                value={addThresholdInput}
                onChange={(event) => setAddThresholdInput(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <button type="submit" disabled={isSubmitting}>
                Propose add signer
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h3>Remove Signer</h3>
          <form onSubmit={(event) => void onProposeRemoveOwner(event)} className="form settingsForm">
            <label htmlFor="removeOwnerAddress">Signer to remove</label>
            <select id="removeOwnerAddress" value={removeOwnerInput} onChange={(event) => setRemoveOwnerInput(event.target.value)}>
              {overview.owners.map((owner) => (
                <option key={owner} value={owner}>
                  {formatAddressFull(owner)}
                </option>
              ))}
            </select>
            <label htmlFor="removeOwnerThreshold">New required confirmations</label>
            <div className="row">
              <input
                id="removeOwnerThreshold"
                value={removeThresholdInput}
                onChange={(event) => setRemoveThresholdInput(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <button type="submit" disabled={isSubmitting || overview.owners.length <= 1}>
                Propose remove signer
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="card">
        <h3>Change Confirmations</h3>
        <form onSubmit={(event) => void onProposeChangeThreshold(event)} className="form settingsForm">
          <label htmlFor="changeThreshold">Required confirmations</label>
          <div className="row">
            <input
              id="changeThreshold"
              value={changeThresholdInput}
              onChange={(event) => setChangeThresholdInput(event.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
            />
            <button type="submit" disabled={isSubmitting}>
              Propose threshold change
            </button>
          </div>
        </form>
      </section>

      {error ? <p className="error">{error}</p> : null}
    </>
  );
}
