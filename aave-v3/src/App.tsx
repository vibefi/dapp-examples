import { WalletBar } from "./components/WalletBar";
import { AccountOverview } from "./components/AccountOverview";
import { AssetPanel } from "./components/AssetPanel";
import { useAccount } from "wagmi";
import { getAddresses, getMarketLabel } from "./addresses";

const aaveLogoUrl = new URL("../assets/aave.webp", import.meta.url).href;

export default function App() {
  const { chainId } = useAccount();
  const addresses = getAddresses(chainId);
  const networkText = addresses?.chainLabel ?? (chainId ? `Unsupported chain (${chainId})` : "Connect wallet");

  return (
    <div className="appRoot">
      <header className="topNav">
        <div className="topNavLeft">
          <img className="topNavLogo" src={aaveLogoUrl} alt="Aave" />
          <span className="navLink active">Dashboard</span>
        </div>
      </header>

      <div className="container">
        <div className="headerCard">
          <div className="brand">
            <img src={aaveLogoUrl} alt="Aave" />
            <div>
              <h1>Core Instance</h1>
              <div className="muted small">{getMarketLabel(chainId)} with deterministic onchain actions</div>
            </div>
          </div>
          <WalletBar />
        </div>

        <div className="summaryRow">
          <div className="summaryItem">
            <div className="small muted">Market</div>
            <div className="summaryValue">{networkText}</div>
          </div>
          <div className="summaryItem">
            <div className="small muted">Protocol</div>
            <div className="summaryValue">Aave V3</div>
          </div>
          <div className="summaryItem">
            <div className="small muted">Execution</div>
            <div className="summaryValue">RPC reads + wallet writes</div>
          </div>
        </div>

        <div className="row grid-2">
          <AccountOverview />
          <AssetPanel />
        </div>

        <div className="card safetyCard">
          <div className="cardTitle">Safety notes</div>
          <ul className="muted small">
            <li>Supplying/repaying ERC20 requires approval to the Aave Pool.</li>
            <li>ETH-native deposits/withdrawals use WrappedTokenGateway and mint/burn aWETH.</li>
            <li>Borrowing can put your position at liquidation risk (watch health factor).</li>
            <li>This UI supports chain IDs 1 and 11155111 with ETH/WETH/USDC/DAI for deterministic behavior.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
