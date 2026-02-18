import { createConfig, custom, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { getRpcUrl } from "./env";

const rpcUrl = getRpcUrl();

function getInjectedTransport() {
  const eth = (window as unknown as { ethereum?: unknown }).ethereum;
  if (eth) return custom(eth);
  // Fallback to http only if no injected provider (shouldn't happen in VibeFi)
  return rpcUrl ? http(rpcUrl) : http();
}

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  connectors: [injected()],
  transports: {
    [mainnet.id]: getInjectedTransport(),
    [sepolia.id]: getInjectedTransport(),
  },
});
