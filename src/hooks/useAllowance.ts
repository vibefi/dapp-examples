import { useEffect, useState } from "react";
import type { Address } from "viem";
import { publicClient } from "../clients";
import { ABI } from "../abis";

export function useAllowance(token?: Address, owner?: Address, spender?: Address) {
  const [allowance, setAllowance] = useState<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token || !owner || !spender) {
        setAllowance(null);
        return;
      }
      try {
        const a = await publicClient.readContract({
          address: token,
          abi: ABI.erc20,
          functionName: "allowance",
          args: [owner, spender],
        }) as bigint;
        if (!cancelled) setAllowance(a);
      } catch {
        if (!cancelled) setAllowance(null);
      }
    }

    run();
    const id = setInterval(run, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, owner, spender]);

  return allowance;
}
