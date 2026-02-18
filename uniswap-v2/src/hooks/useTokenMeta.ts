import { useMemo } from "react";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ABI } from "../abis";
import { addresses } from "../addresses";
import { isAddressLike } from "../utils";

export type TokenMeta = {
  address: Address;
  symbol: string;
  decimals: number;
  name?: string;
};

const WETH_META: TokenMeta = {
  address: addresses.WETH9 as Address,
  symbol: "WETH",
  decimals: 18,
  name: "Wrapped Ether",
};

export function useTokenMeta(
  input: string,
  mode: "token" | "weth" = "token"
): { meta: TokenMeta | null; error: string | null } {
  const client = usePublicClient();
  const addr = useMemo(() => (isAddressLike(input) ? (input as Address) : null), [input]);

  const { data, error } = useQuery({
    queryKey: ["tokenMeta", addr],
    queryFn: async () => {
      const [symbol, decimals, name] = await Promise.all([
        client!.readContract({ address: addr!, abi: ABI.erc20, functionName: "symbol" }) as Promise<string>,
        client!.readContract({ address: addr!, abi: ABI.erc20, functionName: "decimals" }) as Promise<number>,
        client!.readContract({ address: addr!, abi: ABI.erc20, functionName: "name" }) as Promise<string>,
      ]);
      return { address: addr!, symbol, decimals, name };
    },
    enabled: mode === "token" && Boolean(addr && client),
    retry: false,
    staleTime: Infinity,
  });

  if (mode === "weth") return { meta: WETH_META, error: null };
  if (!input.trim()) return { meta: null, error: null };
  if (!addr) return { meta: null, error: "Invalid token address" };
  if (error) return { meta: null, error: "Could not fetch token metadata (is it an ERC-20?)" };
  return { meta: data ?? null, error: null };
}
