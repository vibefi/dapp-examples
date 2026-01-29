import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { publicClient } from "../clients";
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

export function useTokenMeta(input: string, mode: "token" | "weth" = "token") {
  const [meta, setMeta] = useState<TokenMeta | null>(mode === "weth" ? WETH_META : null);
  const [error, setError] = useState<string | null>(null);

  const addr = useMemo(() => (isAddressLike(input) ? (input as Address) : null), [input]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (mode === "weth") {
        setMeta(WETH_META);
        setError(null);
        return;
      }

      if (!addr) {
        setMeta(null);
        setError(input.trim() ? "Invalid token address" : null);
        return;
      }

      try {
        setError(null);
        const [symbol, decimals, name] = await Promise.all([
          publicClient.readContract({ address: addr, abi: ABI.erc20, functionName: "symbol" }) as Promise<string>,
          publicClient.readContract({ address: addr, abi: ABI.erc20, functionName: "decimals" }) as Promise<number>,
          publicClient.readContract({ address: addr, abi: ABI.erc20, functionName: "name" }) as Promise<string>,
        ]);
        if (cancelled) return;
        setMeta({ address: addr, symbol, decimals, name });
      } catch {
        if (cancelled) return;
        setMeta(null);
        setError("Could not fetch token metadata (is it an ERC-20?)");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [addr, input, mode]);

  return { meta, error };
}
