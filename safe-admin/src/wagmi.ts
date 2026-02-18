import { createConfig, custom } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

type EIP1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

function getInjectedProvider(): EIP1193Provider {
  const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  if (!eth) throw new Error("No injected provider found (window.ethereum). This app must run inside a Safe browser context.");
  return eth;
}

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [injected()],
  transports: {
    [mainnet.id]: custom(getInjectedProvider()),
  },
});
