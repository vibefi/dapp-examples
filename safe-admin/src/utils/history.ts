import type { SafeExecutionHistoryItem } from "../types";

export function sortHistory(items: SafeExecutionHistoryItem[]): SafeExecutionHistoryItem[] {
  return [...items].sort((left, right) => {
    if (left.blockNumber !== right.blockNumber) {
      return left.blockNumber > right.blockNumber ? -1 : 1;
    }
    return left.transactionHash.localeCompare(right.transactionHash);
  });
}

export function mergeHistory(
  current: SafeExecutionHistoryItem[],
  incoming: SafeExecutionHistoryItem[],
): SafeExecutionHistoryItem[] {
  const byKey = new Map<string, SafeExecutionHistoryItem>();
  for (const item of current) {
    byKey.set(item.transactionHash, item);
  }
  for (const item of incoming) {
    byKey.set(item.transactionHash, item);
  }
  return sortHistory(Array.from(byKey.values()));
}
