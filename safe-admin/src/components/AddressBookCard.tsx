import { type FormEvent, useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { shortAddress } from "../utils/format";
import type { AddressBookEntry } from "../utils/addressBook";

type AddressBookCardProps = {
  entries: AddressBookEntry[];
  onEntriesChange: (entries: AddressBookEntry[]) => void;
};

export function AddressBookCard({ entries, onEntriesChange }: AddressBookCardProps) {
  const [nameInput, setNameInput] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onAddAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = nameInput.trim();
    const trimmedAddress = addressInput.trim();

    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    if (!isAddress(trimmedAddress)) {
      setError("Enter a valid address.");
      return;
    }

    const checksummedAddress = getAddress(trimmedAddress) as Address;
    const alreadyExists = entries.some((entry) => entry.address === checksummedAddress);
    if (alreadyExists) {
      setError("That address is already saved.");
      return;
    }

    onEntriesChange([
      {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
        name: trimmedName,
        address: checksummedAddress,
      },
      ...entries,
    ]);
    setNameInput("");
    setAddressInput("");
    setError(null);
  }

  function onRemoveAddress(id: string) {
    onEntriesChange(entries.filter((entry) => entry.id !== id));
  }

  return (
    <section className="card">
      <div className="sectionHead">
        <h2>Address Book</h2>
        <span className="chip">{entries.length} saved</span>
      </div>

      <form onSubmit={onAddAddress} className="form addressBookForm">
        <label htmlFor="addressBookName">Name</label>
        <input
          id="addressBookName"
          value={nameInput}
          onChange={(event) => setNameInput(event.target.value)}
          placeholder="Treasury, Ops, Vendor..."
          autoComplete="off"
          spellCheck={false}
        />
        <label htmlFor="addressBookAddress">Address</label>
        <div className="row">
          <input
            id="addressBookAddress"
            value={addressInput}
            onChange={(event) => setAddressInput(event.target.value)}
            placeholder="0x..."
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">Save address</button>
        </div>
      </form>

      {error ? <p className="error">{error}</p> : null}

      {entries.length === 0 ? (
        <p className="muted">No saved addresses yet.</p>
      ) : (
        <ul className="addressBookList">
          {entries.map((entry) => (
            <li key={entry.id} className="addressBookItem">
              <div className="addressBookName">{entry.name}</div>
              <div className="addressBookAddress">
                {entry.name} ({shortAddress(entry.address)})
              </div>
              <button type="button" className="secondary addressBookRemove" onClick={() => onRemoveAddress(entry.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
