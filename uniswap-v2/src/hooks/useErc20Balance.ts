import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { ABI } from "../abis";

export function useErc20Balance(token?: Address, owner?: Address): bigint | null {
  const { data } = useReadContract({
    address: token,
    abi: ABI.erc20,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: { enabled: Boolean(token && owner), refetchInterval: 10_000 },
  });
  return (data as bigint | undefined) ?? null;
}
