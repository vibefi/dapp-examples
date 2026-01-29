import { createPublicClient, createWalletClient, custom, http } from "viem";
import { mainnet } from "viem/chains";
import { getRpcUrl } from "./env";

const rpcUrl = getRpcUrl();

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: rpcUrl ? http(rpcUrl) : http(),
});

export function getWalletClient() {
  const eth = (window as unknown as { ethereum?: unknown }).ethereum;
  if (!eth) return null;
  return createWalletClient({
    chain: mainnet,
    transport: custom(eth),
  });
}

export async function getConnectedAccount(): Promise<`0x${string}` | null> {
  const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!eth) return null;
  const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
  return (accounts?.[0] as `0x${string}` | undefined) ?? null;
}

export async function requestAccount(): Promise<`0x${string}`> {
  const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!eth) throw new Error("No injected wallet found (window.ethereum).");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new Error("No account returned from wallet.");
  return accounts[0] as `0x${string}`;
}

export async function getChainId(): Promise<number | null> {
  const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!eth) return null;
  const hex = (await eth.request({ method: "eth_chainId" })) as string;
  return Number.parseInt(hex, 16);
}

export async function switchToMainnet(): Promise<void> {
  const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!eth) throw new Error("No injected wallet found.");
  await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }] });
}

export function hasRpcUrl(): boolean {
  return Boolean(rpcUrl);
}
