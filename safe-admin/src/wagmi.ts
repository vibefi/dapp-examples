import { createConfig, custom, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { getRpcUrl } from "./env";

type EIP1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

function getTransport() {
  const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  if (eth) return custom(eth);
  const rpcUrl = getRpcUrl();
  return rpcUrl ? http(rpcUrl) : http();
}

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [injected()],
  transports: {
    [mainnet.id]: getTransport(),
  },
});
