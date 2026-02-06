import { useEffect, useState } from "react";
import type { Address } from "viem";
import { publicClient } from "../clients";
import { ABI } from "../abis";

export function useErc20Balance(token?: Address, owner?: Address) {
  const [balance, setBalance] = useState<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token || !owner) {
        setBalance(null);
        return;
      }
      try {
        const b = await publicClient.readContract({
          address: token,
          abi: ABI.erc20,
          functionName: "balanceOf",
          args: [owner],
        }) as bigint;
        if (!cancelled) setBalance(b);
      } catch {
        if (!cancelled) setBalance(null);
      }
    }

    run();
    const id = setInterval(run, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, owner]);

  return balance;
}
