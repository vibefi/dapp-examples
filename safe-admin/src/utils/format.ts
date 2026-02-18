import { formatUnits, type Address } from "viem";
import type { DecodedErc20Call, TokenMetadata } from "../types";

const UINT256_MAX = (1n << 256n) - 1n;
const UINT256_MAX_LIKE_DELTA = 10n ** 24n;

export function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function asNullableDecimals(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : null;
  }
  return null;
}

export function describeOperation(operation: 0 | 1): string {
  return operation === 0 ? "CALL" : "DELEGATECALL";
}

export function formatTimestamp(timestampMs: number | null): string {
  if (!timestampMs) return "unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestampMs));
}

export function formatBlocks(value: bigint): string {
  return Number(value).toLocaleString();
}

export function formatOptionalBlock(value: bigint | null): string {
  if (value === null) return "-";
  return value.toString();
}

export function shortAddress(value: Address): string {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatTokenLabel(token: TokenMetadata | null, formatAddress: (address: Address) => string = shortAddress): string {
  if (!token) return "Unknown token";
  if (token.symbol) return token.symbol;
  if (token.name) return token.name;
  return formatAddress(token.address);
}

export function isInfiniteLikeUint256(value: bigint): boolean {
  return value >= UINT256_MAX - UINT256_MAX_LIKE_DELTA;
}

function trimFraction(value: string, maxFractionDigits: number): string {
  const [whole, fraction] = value.split(".");
  if (!fraction) return whole;
  const capped = fraction.slice(0, maxFractionDigits);
  const trimmed = capped.replace(/0+$/, "");
  if (trimmed.length > 0) return `${whole}.${trimmed}`;

  const hasNonZeroBeyondPrecision = /[1-9]/.test(fraction.slice(maxFractionDigits));
  if (whole === "0" && hasNonZeroBeyondPrecision && maxFractionDigits > 0) {
    return `<0.${"0".repeat(maxFractionDigits - 1)}1`;
  }

  return whole;
}

export function formatUnitsDisplay(value: bigint, decimals: number, maxFractionDigits = 6): string {
  if (isInfiniteLikeUint256(value)) return "∞";
  return trimFraction(formatUnits(value, decimals), maxFractionDigits);
}

export function formatEtherDisplay(valueWei: bigint, maxFractionDigits = 6): string {
  return formatUnitsDisplay(valueWei, 18, maxFractionDigits);
}

export function formatTokenAmount(amount: bigint, token: TokenMetadata | null): string {
  if (isInfiniteLikeUint256(amount)) {
    const unit = token?.symbol ? ` ${token.symbol}` : "";
    return `∞${unit}`;
  }

  if (token?.decimals !== null && token?.decimals !== undefined) {
    const unit = token.symbol ? ` ${token.symbol}` : "";
    return `${formatUnitsDisplay(amount, token.decimals, 6)}${unit}`;
  }
  return amount.toString();
}

export function formatErc20Call(call: DecodedErc20Call, formatAddress: (address: Address) => string = shortAddress): string {
  if (call.method === "transfer") {
    return `transfer ${formatTokenAmount(call.amount, call.token)} to ${formatAddress(call.to)}`;
  }
  if (call.method === "transferFrom") {
    return `transferFrom ${formatAddress(call.from)} -> ${formatAddress(call.to)} amount ${formatTokenAmount(call.amount, call.token)}`;
  }
  return `approve ${formatAddress(call.spender)} amount ${formatTokenAmount(call.amount, call.token)}`;
}
