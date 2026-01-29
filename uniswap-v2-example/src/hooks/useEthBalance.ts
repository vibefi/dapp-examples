import { useEffect, useState } from "react";
import type { Address } from "viem";
import { publicClient } from "../clients";

export function useEthBalance(address?: Address) {
  const [balance, setBalance] = useState<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!address) {
        setBalance(null);
        return;
      }
      try {
        const b = await publicClient.getBalance({ address });
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
  }, [address]);

  return balance;
}
