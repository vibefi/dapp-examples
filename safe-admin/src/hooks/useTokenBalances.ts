import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { erc20Abi, getAddress, isAddress, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { getSeedTokenAddressesForChain } from "../topErc20Tokens";
import type { TokenMetadata } from "../types";
import { asNullableDecimals, asNullableString } from "../utils/format";

export type DetectedTokenBalance = {
  address: Address;
  token: TokenMetadata | null;
  balance: bigint;
  isCustomTracked: boolean;
};

type UseTokenBalancesResult = {
  customTokenInput: string;
  setCustomTokenInput: Dispatch<SetStateAction<string>>;
  customTrackedTokens: Address[];
  trackedTokenAddresses: Address[];
  detectedTokenBalances: DetectedTokenBalance[];
  tokenBalanceError: string | null;
  isCheckingTokenBalances: boolean;
  checkedTokenCount: number;
  addCustomTokenFromInput: () => void;
  resetDetectedBalances: () => void;
};

export function useTokenBalances(activeSafeAddress: Address | null, activeChainId: number | null): UseTokenBalancesResult {
  const [customTokenInput, setCustomTokenInput] = useState("");
  const [customTrackedTokens, setCustomTrackedTokens] = useState<Address[]>([]);
  const [tokenBalanceError, setTokenBalanceError] = useState<string | null>(null);
  const [tokenCheckProgress, setTokenCheckProgress] = useState({
    isChecking: false,
    checkedCount: 0,
    totalCount: 0,
  });
  const [liveBalanceEntries, setLiveBalanceEntries] = useState<{ address: Address; balance: bigint }[]>([]);
  const [metadataMap, setMetadataMap] = useState<Map<string, TokenMetadata>>(new Map());
  const tokenCheckRunIdRef = useRef(0);
  const knownMetadataAddressesRef = useRef(new Set<string>());
  const metadataInFlightRef = useRef(new Set<string>());

  const client = usePublicClient({ chainId: activeChainId ?? undefined });

  const customTrackedTokenSet = useMemo(() => {
    return new Set(customTrackedTokens.map((t) => t.toLowerCase()));
  }, [customTrackedTokens]);

  const chainSeedTokenAddresses = useMemo(() => {
    return getSeedTokenAddressesForChain(activeChainId);
  }, [activeChainId]);

  const trackedTokenAddresses = useMemo(() => {
    const deduped: Address[] = [];
    const seen = new Set<string>();

    for (const tokenAddress of chainSeedTokenAddresses) {
      const normalized = tokenAddress.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      deduped.push(tokenAddress);
    }

    for (const tokenAddress of customTrackedTokens) {
      const normalized = tokenAddress.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      deduped.push(tokenAddress);
    }

    return deduped;
  }, [chainSeedTokenAddresses, customTrackedTokens]);

  useEffect(() => {
    tokenCheckRunIdRef.current += 1;
    knownMetadataAddressesRef.current.clear();
    metadataInFlightRef.current.clear();
    setLiveBalanceEntries([]);
    setMetadataMap(new Map());
    setTokenCheckProgress({ isChecking: false, checkedCount: 0, totalCount: 0 });
  }, [activeSafeAddress, activeChainId]);

  // Fetch all balances via individual readContract calls (no multicall)
  const { error: balanceQueryError, status: balanceQueryStatus, fetchStatus: balanceFetchStatus } = useQuery({
    queryKey: ["tokenBalances", activeChainId, activeSafeAddress, trackedTokenAddresses],
    queryFn: async () => {
      if (!client || !activeSafeAddress) {
        tokenCheckRunIdRef.current += 1;
        setTokenCheckProgress({ isChecking: false, checkedCount: 0, totalCount: 0 });
        return null;
      }

      const totalCount = trackedTokenAddresses.length;
      if (totalCount === 0) {
        tokenCheckRunIdRef.current += 1;
        setTokenCheckProgress({ isChecking: false, checkedCount: 0, totalCount: 0 });
        return null;
      }

      const runId = tokenCheckRunIdRef.current + 1;
      tokenCheckRunIdRef.current = runId;
      const setProgressIfCurrent = (next: { isChecking: boolean; checkedCount: number; totalCount: number }) => {
        if (tokenCheckRunIdRef.current !== runId) return;
        setTokenCheckProgress(next);
      };

      let checkedCount = 0;
      setProgressIfCurrent({ isChecking: true, checkedCount: 0, totalCount });

      console.log("[useTokenBalances] queryFn fired", {
        activeChainId,
        activeSafeAddress,
        trackedCount: trackedTokenAddresses.length,
        clientChain: client.chain?.id,
      });

      const fetchTokenMetadata = (addr: Address) => {
        const normalized = addr.toLowerCase();
        if (knownMetadataAddressesRef.current.has(normalized)) return;
        if (metadataInFlightRef.current.has(normalized)) return;

        metadataInFlightRef.current.add(normalized);
        void (async () => {
          try {
            const [name, symbol, decimals] = await Promise.allSettled([
              client.readContract({ address: addr, abi: erc20Abi, functionName: "name" }),
              client.readContract({ address: addr, abi: erc20Abi, functionName: "symbol" }),
              client.readContract({ address: addr, abi: erc20Abi, functionName: "decimals" }),
            ]);

            const n = name.status === "fulfilled" ? asNullableString(name.value) : null;
            const s = symbol.status === "fulfilled" ? asNullableString(symbol.value) : null;
            const d = decimals.status === "fulfilled" ? asNullableDecimals(decimals.value) : null;
            if (n === null && s === null && d === null) return;
            if (tokenCheckRunIdRef.current !== runId) return;

            knownMetadataAddressesRef.current.add(normalized);
            setMetadataMap((current) => {
              if (current.has(normalized)) return current;
              const next = new Map(current);
              next.set(normalized, { address: addr, name: n, symbol: s, decimals: d } satisfies TokenMetadata);
              return next;
            });
          } finally {
            metadataInFlightRef.current.delete(normalized);
          }
        })();
      };

      const maxConcurrentBalanceReads = Math.min(20, totalCount);
      let nextIndex = 0;

      const runWorker = async () => {
        while (true) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= totalCount) return;

          const addr = trackedTokenAddresses[index];
          const normalizedAddress = addr.toLowerCase();

          try {
            const balance = await client.readContract({
              address: addr,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [activeSafeAddress],
            });

            if (tokenCheckRunIdRef.current !== runId) return;
            if (typeof balance !== "bigint") continue;
            if (balance > 0n) fetchTokenMetadata(addr);

            setLiveBalanceEntries((current) => {
              const next = [...current];
              const existingIndex = next.findIndex((entry) => entry.address.toLowerCase() === normalizedAddress);

              if (balance > 0n) {
                if (existingIndex >= 0) {
                  if (next[existingIndex].balance === balance) return current;
                  next[existingIndex] = { address: addr, balance };
                  return next;
                }
                next.push({ address: addr, balance });
                return next;
              }

              if (existingIndex >= 0) {
                next.splice(existingIndex, 1);
                return next;
              }
              return current;
            });
          } finally {
            checkedCount += 1;
            setProgressIfCurrent({
              isChecking: true,
              checkedCount,
              totalCount,
            });
          }
        }
      };

      await Promise.all(Array.from({ length: maxConcurrentBalanceReads }, () => runWorker()));

      setProgressIfCurrent({ isChecking: false, checkedCount: totalCount, totalCount });
      return null;
    },
    enabled: !!activeSafeAddress && !!client && activeChainId !== null,
    refetchInterval: 5_000,
  });

  // Debug: log query state on every render where relevant values change
  console.log("[useTokenBalances] render", {
    activeChainId,
    activeSafeAddress,
    clientExists: !!client,
    balanceQueryStatus,
    balanceFetchStatus,
    balanceQueryError: balanceQueryError ? String(balanceQueryError) : null,
    balanceEntriesCount: liveBalanceEntries.length,
    enabled: !!activeSafeAddress && !!client,
  });

  const detectedTokenBalances = useMemo(() => {
    return liveBalanceEntries
      .map((entry) => ({
        address: entry.address,
        token: metadataMap.get(entry.address.toLowerCase()) ?? null,
        balance: entry.balance,
        isCustomTracked: customTrackedTokenSet.has(entry.address.toLowerCase()),
      }))
      .sort((left, right) => {
        const leftValue = left.token?.symbol ?? left.token?.name ?? left.address;
        const rightValue = right.token?.symbol ?? right.token?.name ?? right.address;
        return leftValue.localeCompare(rightValue);
      });
  }, [liveBalanceEntries, metadataMap, customTrackedTokenSet]);

  function resetDetectedBalances() {
    setTokenBalanceError(null);
  }

  function addCustomTokenFromInput() {
    const trimmed = customTokenInput.trim();

    if (!isAddress(trimmed)) {
      setTokenBalanceError("Enter a valid ERC20 token contract address.");
      return;
    }

    const tokenAddress = getAddress(trimmed) as Address;
    const alreadyTracked = customTrackedTokens.some(
      (existingAddress) => existingAddress.toLowerCase() === tokenAddress.toLowerCase(),
    );

    if (alreadyTracked) {
      setTokenBalanceError("Token is already being tracked.");
      return;
    }

    setCustomTrackedTokens((current) => [...current, tokenAddress]);
    setCustomTokenInput("");
    setTokenBalanceError(null);
  }

  return {
    customTokenInput,
    setCustomTokenInput,
    customTrackedTokens,
    trackedTokenAddresses,
    detectedTokenBalances,
    tokenBalanceError,
    isCheckingTokenBalances: tokenCheckProgress.isChecking,
    checkedTokenCount: tokenCheckProgress.isChecking ? tokenCheckProgress.checkedCount : tokenCheckProgress.totalCount,
    addCustomTokenFromInput,
    resetDetectedBalances,
  };
}
