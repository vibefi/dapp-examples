import { getAddress, isAddress, type Address } from "viem";

export type AddressBookEntry = {
  id: string;
  name: string;
  address: Address;
};

export const ADDRESS_BOOK_STORAGE_KEY = "safe-admin-address-book-v1";

export function loadAddressBookEntries(): AddressBookEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(ADDRESS_BOOK_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((value): AddressBookEntry[] => {
      if (typeof value !== "object" || value === null) return [];

      const { id, name, address } = value as { id?: unknown; name?: unknown; address?: unknown };
      if (typeof id !== "string" || typeof name !== "string" || typeof address !== "string" || !isAddress(address)) {
        return [];
      }

      const trimmedName = name.trim();
      if (!trimmedName) return [];

      return [{ id, name: trimmedName, address: getAddress(address) as Address }];
    });
  } catch {
    return [];
  }
}

export function saveAddressBookEntries(entries: AddressBookEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADDRESS_BOOK_STORAGE_KEY, JSON.stringify(entries));
}
