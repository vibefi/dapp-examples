import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { ABI } from "../abis";

export function useAllowance(token?: Address, owner?: Address, spender?: Address): bigint | null {
  const { data } = useReadContract({
    address: token,
    abi: ABI.erc20,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: Boolean(token && owner && spender), refetchInterval: 10_000 },
  });
  return (data as bigint | undefined) ?? null;
}
