import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { getAddresses, getChainLabel, isSupportedChainId } from "../addresses";
import { Button } from "./Button";
import { shortenAddress } from "../format";

export function WalletBar() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const network = getAddresses(chainId);
  const chainText = chainId ? `${getChainLabel(chainId)} (${chainId})` : "—";
  const unsupportedConnectedChain = Boolean(isConnected && chainId && !isSupportedChainId(chainId));

  return (
    <div className="walletBar">
      <span className="pill">
        <span className="muted">Wallet</span>
        <span className="pillValue">{isConnected ? shortenAddress(address) : "Not connected"}</span>
      </span>

      <span className="pill">
        <span className="muted">Chain</span>
        <span className="pillValue">{chainText}</span>
      </span>

      {network ? (
        <span className="pill">
          <span className="muted">Market</span>
          <span className="pillValue">{network.marketLabel}</span>
        </span>
      ) : null}

      {!isConnected ? (
        <button
          className="btn primary"
          disabled={isConnecting}
          onClick={() => connect({ connector: injected() })}
          title="Connect injected wallet (window.ethereum)"
        >
          {isConnecting ? "Connecting…" : "Connect"}
        </button>
      ) : (
        <Button variant="danger" onClick={() => disconnect()}>
          Disconnect
        </Button>
      )}

      {connectError ? (
        <span className="status bad">{String((connectError as any).message ?? connectError)}</span>
      ) : null}

      {unsupportedConnectedChain ? <span className="status bad">Unsupported network for this app</span> : null}
    </div>
  );
}
