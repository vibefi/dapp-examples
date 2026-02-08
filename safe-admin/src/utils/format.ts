import { formatUnits, type Address } from "viem";
import type { DecodedErc20Call, TokenMetadata } from "../types";

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

export function isSameTokenMetadata(left: TokenMetadata | null, right: TokenMetadata | null): boolean {
  if (left === null || right === null) return left === right;
  return (
    left.address.toLowerCase() === right.address.toLowerCase() &&
    left.name === right.name &&
    left.symbol === right.symbol &&
    left.decimals === right.decimals
  );
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

export function formatTokenLabel(token: TokenMetadata | null): string {
  if (!token) return "Unknown token";
  if (token.symbol) return token.symbol;
  if (token.name) return token.name;
  return shortAddress(token.address);
}

export function formatTokenAmount(amount: bigint, token: TokenMetadata | null): string {
  if (token?.decimals !== null && token?.decimals !== undefined) {
    const unit = token.symbol ? ` ${token.symbol}` : "";
    return `${formatUnits(amount, token.decimals)}${unit}`;
  }
  return amount.toString();
}

export function formatErc20Call(call: DecodedErc20Call): string {
  if (call.method === "transfer") {
    return `transfer ${formatTokenAmount(call.amount, call.token)} to ${shortAddress(call.to)}`;
  }
  if (call.method === "transferFrom") {
    return `transferFrom ${shortAddress(call.from)} -> ${shortAddress(call.to)} amount ${formatTokenAmount(call.amount, call.token)}`;
  }
  return `approve ${shortAddress(call.spender)} amount ${formatTokenAmount(call.amount, call.token)}`;
}
