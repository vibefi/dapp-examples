import {
  bytesToHex,
  concat,
  getAddress,
  hashTypedData,
  hexToBytes,
  isAddress,
  isHex,
  recoverAddress,
  type Address,
  type Hex,
} from "viem";
import type {
  SafeProposedTransaction,
  SafeProposalSignature,
  SafeTransactionPayload,
  SharedSafeProposalPayload,
} from "../types";

export const SAFE_PROPOSALS_STORAGE_KEY = "safe-admin-proposals-v1";

type RawSafeProposedTransaction = {
  id: unknown;
  createdAtMs: unknown;
  updatedAtMs: unknown;
  chainId: unknown;
  safeAddress: unknown;
  safeTxHash: unknown;
  title: unknown;
  description: unknown;
  tx: {
    to: unknown;
    value: unknown;
    data: unknown;
    operation: unknown;
    safeTxGas: unknown;
    baseGas: unknown;
    gasPrice: unknown;
    gasToken: unknown;
    refundReceiver: unknown;
    nonce: unknown;
  };
  signatures: unknown;
  executedTxHash: unknown;
  executedAtMs: unknown;
};

const SAFE_TX_TYPES = {
  SafeTx: [
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
    { name: "operation", type: "uint8" },
    { name: "safeTxGas", type: "uint256" },
    { name: "baseGas", type: "uint256" },
    { name: "gasPrice", type: "uint256" },
    { name: "gasToken", type: "address" },
    { name: "refundReceiver", type: "address" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

function parseAddress(value: unknown): Address | null {
  if (typeof value !== "string" || !isAddress(value)) return null;
  return getAddress(value) as Address;
}

function parseHex(value: unknown): Hex | null {
  if (typeof value !== "string" || !isHex(value)) return null;
  return value as Hex;
}

function parseBigintFromString(value: unknown): bigint | null {
  if (typeof value !== "string") return null;
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function parseOperation(value: unknown): 0 | 1 | null {
  return value === 0 || value === 1 ? value : null;
}

function parseSignature(value: unknown): SafeProposalSignature | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as { owner?: unknown; signature?: unknown };
  const owner = parseAddress(entry.owner);
  const signature = parseHex(entry.signature);
  if (!owner || !signature) return null;
  const normalized = normalizeEcdsaSignature(signature);
  if (!normalized) return null;
  return { owner, signature: normalized };
}

function parseTransactionPayload(value: RawSafeProposedTransaction["tx"]): SafeTransactionPayload | null {
  const to = parseAddress(value.to);
  const data = parseHex(value.data);
  const operation = parseOperation(value.operation);
  const gasToken = parseAddress(value.gasToken);
  const refundReceiver = parseAddress(value.refundReceiver);
  const parsed = {
    value: parseBigintFromString(value.value),
    safeTxGas: parseBigintFromString(value.safeTxGas),
    baseGas: parseBigintFromString(value.baseGas),
    gasPrice: parseBigintFromString(value.gasPrice),
    nonce: parseBigintFromString(value.nonce),
  };

  if (
    !to ||
    !data ||
    operation === null ||
    !gasToken ||
    !refundReceiver ||
    parsed.value === null ||
    parsed.safeTxGas === null ||
    parsed.baseGas === null ||
    parsed.gasPrice === null ||
    parsed.nonce === null
  ) {
    return null;
  }

  return {
    to,
    value: parsed.value,
    data,
    operation,
    safeTxGas: parsed.safeTxGas,
    baseGas: parsed.baseGas,
    gasPrice: parsed.gasPrice,
    gasToken,
    refundReceiver,
    nonce: parsed.nonce,
  };
}

export function buildSafeTxTypedData(safeAddress: Address, chainId: number, tx: SafeTransactionPayload) {
  return {
    domain: {
      chainId,
      verifyingContract: safeAddress,
    },
    types: SAFE_TX_TYPES,
    primaryType: "SafeTx" as const,
    message: {
      to: tx.to,
      value: tx.value,
      data: tx.data,
      operation: tx.operation,
      safeTxGas: tx.safeTxGas,
      baseGas: tx.baseGas,
      gasPrice: tx.gasPrice,
      gasToken: tx.gasToken,
      refundReceiver: tx.refundReceiver,
      nonce: tx.nonce,
    },
  };
}

export function computeSafeTxHash(safeAddress: Address, chainId: number, tx: SafeTransactionPayload): Hex {
  const typedData = buildSafeTxTypedData(safeAddress, chainId, tx);
  return hashTypedData(typedData) as Hex;
}

export function normalizeEcdsaSignature(signature: Hex): Hex | null {
  try {
    const bytes = hexToBytes(signature);
    if (bytes.length !== 65) return null;
    const normalized = new Uint8Array(bytes);
    if (normalized[64] < 27) normalized[64] += 27;
    return bytesToHex(normalized) as Hex;
  } catch {
    return null;
  }
}

export async function isSignatureValidForOwner(hash: Hex, owner: Address, signature: Hex): Promise<boolean> {
  try {
    const recovered = await recoverAddress({ hash, signature });
    return recovered.toLowerCase() === owner.toLowerCase();
  } catch {
    return false;
  }
}

export function countOwnerSignatures(proposal: SafeProposedTransaction, ownerAddresses: Address[]): number {
  const ownerSet = new Set(ownerAddresses.map((owner) => owner.toLowerCase()));
  const seen = new Set<string>();
  for (const entry of proposal.signatures) {
    const normalizedOwner = entry.owner.toLowerCase();
    if (!ownerSet.has(normalizedOwner)) continue;
    seen.add(normalizedOwner);
  }
  return seen.size;
}

export function mergeSignatures(existing: SafeProposalSignature[], incoming: SafeProposalSignature[]): SafeProposalSignature[] {
  const byOwner = new Map<string, SafeProposalSignature>();
  for (const item of existing) byOwner.set(item.owner.toLowerCase(), item);
  for (const item of incoming) byOwner.set(item.owner.toLowerCase(), item);
  return [...byOwner.values()].sort((a, b) => a.owner.toLowerCase().localeCompare(b.owner.toLowerCase()));
}

export function buildSignatureBytes(
  proposal: SafeProposedTransaction,
  ownerAddresses: Address[],
): Hex {
  const ownerSet = new Set(ownerAddresses.map((owner) => owner.toLowerCase()));
  const sorted = [...proposal.signatures]
    .filter((entry) => ownerSet.has(entry.owner.toLowerCase()))
    .sort((a, b) => a.owner.toLowerCase().localeCompare(b.owner.toLowerCase()));
  return concat(sorted.map((entry) => entry.signature)) as Hex;
}

export function loadSafeProposals(): SafeProposedTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAFE_PROPOSALS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const proposals: SafeProposedTransaction[] = [];
    for (const value of parsed) {
      const candidate = value as RawSafeProposedTransaction;
      if (typeof candidate !== "object" || candidate === null) continue;

      const safeAddress = parseAddress(candidate.safeAddress);
      const safeTxHash = parseHex(candidate.safeTxHash);
      const tx = parseTransactionPayload(candidate.tx);
      const createdAtMs = parseOptionalNumber(candidate.createdAtMs);
      const updatedAtMs = parseOptionalNumber(candidate.updatedAtMs);
      const chainId = parseOptionalNumber(candidate.chainId);
      const title = typeof candidate.title === "string" ? candidate.title : null;
      const description =
        candidate.description === null || typeof candidate.description === "string" ? candidate.description : null;
      const executedTxHash = candidate.executedTxHash === null ? null : parseHex(candidate.executedTxHash);
      const executedAtMs = candidate.executedAtMs === null ? null : parseOptionalNumber(candidate.executedAtMs);
      const id = typeof candidate.id === "string" ? candidate.id : null;
      const signatures = Array.isArray(candidate.signatures)
        ? candidate.signatures.flatMap((entry): SafeProposalSignature[] => {
            const parsedSignature = parseSignature(entry);
            return parsedSignature ? [parsedSignature] : [];
          })
        : [];

      if (
        !id ||
        safeAddress === null ||
        safeTxHash === null ||
        tx === null ||
        createdAtMs === null ||
        updatedAtMs === null ||
        chainId === null ||
        !Number.isInteger(chainId) ||
        !title ||
        executedTxHash === undefined ||
        executedAtMs === undefined
      ) {
        continue;
      }

      proposals.push({
        id,
        createdAtMs,
        updatedAtMs,
        chainId,
        safeAddress,
        safeTxHash,
        title,
        description,
        tx,
        signatures: mergeSignatures([], signatures),
        executedTxHash,
        executedAtMs,
      });
    }

    return proposals.sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch {
    return [];
  }
}

export function saveSafeProposals(proposals: SafeProposedTransaction[]): void {
  if (typeof window === "undefined") return;
  const encoded = proposals.map((proposal) => ({
    ...proposal,
    tx: {
      ...proposal.tx,
      value: proposal.tx.value.toString(),
      safeTxGas: proposal.tx.safeTxGas.toString(),
      baseGas: proposal.tx.baseGas.toString(),
      gasPrice: proposal.tx.gasPrice.toString(),
      nonce: proposal.tx.nonce.toString(),
    },
  }));
  window.localStorage.setItem(SAFE_PROPOSALS_STORAGE_KEY, JSON.stringify(encoded));
}

export function toSharedProposalPayload(proposal: SafeProposedTransaction): SharedSafeProposalPayload {
  return {
    version: 1,
    chainId: proposal.chainId,
    safeAddress: proposal.safeAddress,
    safeTxHash: proposal.safeTxHash,
    title: proposal.title,
    description: proposal.description,
    tx: {
      to: proposal.tx.to,
      value: proposal.tx.value.toString(),
      data: proposal.tx.data,
      operation: proposal.tx.operation,
      safeTxGas: proposal.tx.safeTxGas.toString(),
      baseGas: proposal.tx.baseGas.toString(),
      gasPrice: proposal.tx.gasPrice.toString(),
      gasToken: proposal.tx.gasToken,
      refundReceiver: proposal.tx.refundReceiver,
      nonce: proposal.tx.nonce.toString(),
    },
    signatures: proposal.signatures,
  };
}

export function parseSharedProposalPayload(raw: unknown): SharedSafeProposalPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw as Record<string, unknown>;

  if (candidate.version !== 1) return null;
  const safeAddress = parseAddress(candidate.safeAddress);
  const safeTxHash = parseHex(candidate.safeTxHash);
  const chainId = parseOptionalNumber(candidate.chainId);
  const title = typeof candidate.title === "string" ? candidate.title : undefined;
  const description =
    candidate.description === undefined || candidate.description === null || typeof candidate.description === "string"
      ? (candidate.description as string | null | undefined)
      : undefined;
  const txRaw = candidate.tx as Record<string, unknown> | undefined;
  const signaturesRaw = Array.isArray(candidate.signatures) ? candidate.signatures : null;

  if (!safeAddress || !safeTxHash || chainId === null || !Number.isInteger(chainId) || !txRaw || !signaturesRaw) return null;

  const to = parseAddress(txRaw.to);
  const data = parseHex(txRaw.data);
  const operation = parseOperation(txRaw.operation);
  const gasToken = parseAddress(txRaw.gasToken);
  const refundReceiver = parseAddress(txRaw.refundReceiver);
  const value = parseBigintFromString(txRaw.value);
  const safeTxGas = parseBigintFromString(txRaw.safeTxGas);
  const baseGas = parseBigintFromString(txRaw.baseGas);
  const gasPrice = parseBigintFromString(txRaw.gasPrice);
  const nonce = parseBigintFromString(txRaw.nonce);
  const signatures = signaturesRaw.flatMap((entry): SafeProposalSignature[] => {
    const parsedSignature = parseSignature(entry);
    return parsedSignature ? [parsedSignature] : [];
  });

  if (
    !to ||
    !data ||
    operation === null ||
    !gasToken ||
    !refundReceiver ||
    value === null ||
    safeTxGas === null ||
    baseGas === null ||
    gasPrice === null ||
    nonce === null
  ) {
    return null;
  }

  return {
    version: 1,
    chainId,
    safeAddress,
    safeTxHash,
    title,
    description,
    tx: {
      to,
      value: value.toString(),
      data,
      operation,
      safeTxGas: safeTxGas.toString(),
      baseGas: baseGas.toString(),
      gasPrice: gasPrice.toString(),
      gasToken,
      refundReceiver,
      nonce: nonce.toString(),
    },
    signatures,
  };
}

