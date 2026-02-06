import * as React from 'react'
import { WalletBar } from './components/WalletBar'
import { AccountOverview } from './components/AccountOverview'
import { AssetPanel } from './components/AssetPanel'

export default function App() {
  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <img src="/assets/aave.webp" alt="Aave" />
          <div>
            <h1>Aave V3 – Ethereum Mainnet</h1>
            <div className="muted small">RPC-only reads + window.ethereum writes</div>
          </div>
        </div>
        <WalletBar />
      </div>

      <div className="row grid-2">
        <AccountOverview />
        <AssetPanel />
      </div>

      <div style={{ marginTop: 16 }} className="card">
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Safety notes</div>
        <ul className="muted small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
          <li>Supplying/repaying ERC20 requires approval to the Aave Pool.</li>
          <li>ETH-native deposits/withdrawals use WrappedTokenGateway and mint/burn aWETH.</li>
          <li>Borrowing can put your position at liquidation risk (watch health factor).</li>
          <li>This UI only includes ETH/WETH/USDC/DAI to keep it deterministic without offchain token lists.</li>
        </ul>
      </div>
    </div>
  )
}
