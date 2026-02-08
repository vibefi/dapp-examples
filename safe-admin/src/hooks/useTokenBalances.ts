import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { erc20Abi, getAddress, isAddress, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { TOP_ERC20_TOKEN_ADDRESSES } from "../topErc20Tokens";
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
  addCustomTokenFromInput: () => void;
  resetDetectedBalances: () => void;
};

export function useTokenBalances(activeSafeAddress: Address | null): UseTokenBalancesResult {
  const [customTokenInput, setCustomTokenInput] = useState("");
  const [customTrackedTokens, setCustomTrackedTokens] = useState<Address[]>([]);
  const [tokenBalanceError, setTokenBalanceError] = useState<string | null>(null);

  const client = usePublicClient();

  const customTrackedTokenSet = useMemo(() => {
    return new Set(customTrackedTokens.map((t) => t.toLowerCase()));
  }, [customTrackedTokens]);

  const trackedTokenAddresses = useMemo(() => {
    const deduped: Address[] = [];
    const seen = new Set<string>();

    for (const tokenAddress of TOP_ERC20_TOKEN_ADDRESSES) {
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
  }, [customTrackedTokens]);

  // Fetch all balances via individual readContract calls (no multicall)
  const { data: balanceEntries, error: balanceQueryError, status: balanceQueryStatus, fetchStatus: balanceFetchStatus } = useQuery({
    queryKey: ["tokenBalances", activeSafeAddress, trackedTokenAddresses],
    queryFn: async () => {
      if (!client || !activeSafeAddress) return [];

      console.log("[useTokenBalances] queryFn fired", {
        activeSafeAddress,
        trackedCount: trackedTokenAddresses.length,
        clientChain: client.chain?.id,
      });

      // Try a single read first to validate the client works
      try {
        const testAddr = trackedTokenAddresses[0];
        console.log("[useTokenBalances] testing single readContract for", testAddr, "owner", activeSafeAddress);
        const testResult = await client.readContract({
          address: testAddr,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [activeSafeAddress],
        });
        console.log("[useTokenBalances] single test result:", testAddr, String(testResult));
      } catch (testErr) {
        console.error("[useTokenBalances] single test readContract FAILED:", testErr);
      }

      const results = await Promise.allSettled(
        trackedTokenAddresses.map((addr) =>
          client.readContract({
            address: addr,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [activeSafeAddress],
          }),
        ),
      );

      let fulfilled = 0;
      let rejected = 0;
      let nonZero = 0;
      const sampleErrors: string[] = [];

      const entries: { address: Address; balance: bigint }[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled" && typeof result.value === "bigint") {
          fulfilled++;
          if (result.value > 0n) {
            nonZero++;
            entries.push({ address: trackedTokenAddresses[i], balance: result.value });
          }
        } else {
          rejected++;
          if (sampleErrors.length < 3 && result.status === "rejected") {
            sampleErrors.push(`${trackedTokenAddresses[i]}: ${String(result.reason)}`);
          }
        }
      }

      console.log("[useTokenBalances] batch results", { fulfilled, rejected, nonZero, total: results.length });
      if (sampleErrors.length > 0) {
        console.warn("[useTokenBalances] sample errors:", sampleErrors);
      }

      return entries;
    },
    enabled: !!activeSafeAddress && !!client,
    refetchInterval: 15_000,
  });

  // Debug: log query state on every render where relevant values change
  console.log("[useTokenBalances] render", {
    activeSafeAddress,
    clientExists: !!client,
    balanceQueryStatus,
    balanceFetchStatus,
    balanceQueryError: balanceQueryError ? String(balanceQueryError) : null,
    balanceEntriesCount: balanceEntries?.length ?? null,
    enabled: !!activeSafeAddress && !!client,
  });

  // Fetch metadata only for tokens with non-zero balances
  const nonZeroAddresses = useMemo(
    () => (balanceEntries ?? []).map((e) => e.address),
    [balanceEntries],
  );

  const { data: metadataMap } = useQuery({
    queryKey: ["tokenMetadata", nonZeroAddresses],
    queryFn: async () => {
      if (!client || nonZeroAddresses.length === 0) return new Map<string, TokenMetadata>();

      const results = await Promise.allSettled(
        nonZeroAddresses.map(async (addr) => {
          const [name, symbol, decimals] = await Promise.allSettled([
            client.readContract({ address: addr, abi: erc20Abi, functionName: "name" }),
            client.readContract({ address: addr, abi: erc20Abi, functionName: "symbol" }),
            client.readContract({ address: addr, abi: erc20Abi, functionName: "decimals" }),
          ]);

          const n = name.status === "fulfilled" ? asNullableString(name.value) : null;
          const s = symbol.status === "fulfilled" ? asNullableString(symbol.value) : null;
          const d = decimals.status === "fulfilled" ? asNullableDecimals(decimals.value) : null;

          if (n === null && s === null && d === null) return null;
          return { address: addr, name: n, symbol: s, decimals: d } satisfies TokenMetadata;
        }),
      );

      const map = new Map<string, TokenMetadata>();
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled" && result.value) {
          map.set(nonZeroAddresses[i].toLowerCase(), result.value);
        }
      }
      return map;
    },
    enabled: nonZeroAddresses.length > 0 && !!client,
    staleTime: Infinity,
  });

  const detectedTokenBalances = useMemo(() => {
    if (!balanceEntries) return [];

    return balanceEntries
      .map((entry) => ({
        address: entry.address,
        token: metadataMap?.get(entry.address.toLowerCase()) ?? null,
        balance: entry.balance,
        isCustomTracked: customTrackedTokenSet.has(entry.address.toLowerCase()),
      }))
      .sort((left, right) => {
        const leftValue = left.token?.symbol ?? left.token?.name ?? left.address;
        const rightValue = right.token?.symbol ?? right.token?.name ?? right.address;
        return leftValue.localeCompare(rightValue);
      });
  }, [balanceEntries, metadataMap, customTrackedTokenSet]);

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
    addCustomTokenFromInput,
    resetDetectedBalances,
  };
}
