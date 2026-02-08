import { type Chain, createPublicClient, custom, http } from "viem";
import { mainnet } from "viem/chains";
import { getConfiguredChainId, getRpcUrl } from "./env";

export type EthereumProvider = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
};

function getInjectedProvider(): EthereumProvider | null {
  const provider = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  return provider ?? null;
}

export function hasInjectedProvider(): boolean {
  return getInjectedProvider() !== null;
}

export function getReadTransport() {
  const injected = getInjectedProvider();
  if (injected) return custom(injected);

  const rpcUrl = getRpcUrl();
  return rpcUrl ? http(rpcUrl) : http();
}

function chainFromId(chainId: number): Chain {
  if (chainId === mainnet.id) return mainnet;

  const rpcUrl = getRpcUrl();
  if (!rpcUrl) {
    throw new Error(`Unsupported chain ${chainId} without RPC_URL or VITE_RPC_URL.`);
  }

  return {
    id: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [rpcUrl],
      },
      public: {
        http: [rpcUrl],
      },
    },
  };
}

export const publicClient = createPublicClient({
  chain: chainFromId(getConfiguredChainId()),
  transport: getReadTransport(),
});

export function createPublicReadClient(chainId = getConfiguredChainId()) {
  return createPublicClient({
    chain: chainFromId(chainId),
    transport: getReadTransport(),
  });
}

export async function getConnectedAccount(): Promise<`0x${string}` | null> {
  const provider = getInjectedProvider();
  if (!provider) return null;

  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  return (accounts?.[0] as `0x${string}` | undefined) ?? null;
}

export async function getConnectedChainId(): Promise<number | null> {
  const provider = getInjectedProvider();
  if (!provider) return null;

  const hex = (await provider.request({ method: "eth_chainId" })) as string;
  const chainId = Number.parseInt(hex, 16);
  return Number.isFinite(chainId) ? chainId : null;
}
