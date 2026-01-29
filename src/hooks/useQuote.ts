import { useEffect, useState } from "react";
import type { Address } from "viem";
import { publicClient } from "../clients";
import { ABI } from "../abis";
import { addresses } from "../addresses";

export type QuoteState =
  | { status: "idle"; amountOut?: undefined; error?: undefined }
  | { status: "loading"; amountOut?: undefined; error?: undefined }
  | { status: "ready"; amountOut: bigint; error?: undefined }
  | { status: "error"; amountOut?: undefined; error: string };

export function useQuote(amountIn?: bigint | null, path?: Address[] | null) {
  const [state, setState] = useState<QuoteState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!amountIn || amountIn <= 0n || !path || path.length < 2) {
        setState({ status: "idle" });
        return;
      }
      setState({ status: "loading" });
      try {
        const amounts = await publicClient.readContract({
          address: addresses.UniswapV2Router02 as Address,
          abi: ABI.router,
          functionName: "getAmountsOut",
          args: [amountIn, path],
        }) as bigint[];
        if (cancelled) return;
        const out = amounts[amounts.length - 1] ?? 0n;
        setState({ status: "ready", amountOut: out });
      } catch {
        if (cancelled) return;
        setState({ status: "error", error: "No route / insufficient liquidity / RPC error" });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [amountIn, JSON.stringify(path)]);

  return state;
}
