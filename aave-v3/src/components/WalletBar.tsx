import * as React from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { Button } from '../ui'
import { shortenAddress } from '../format'

export function WalletBar() {
  const { address, isConnected, chainId } = useAccount()
  const { connect, isPending: isConnecting, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span className="pill">
        <span className="muted">Wallet</span>
        <span style={{ fontWeight: 800 }}>{isConnected ? shortenAddress(address) : 'Not connected'}</span>
      </span>

      <span className="pill">
        <span className="muted">Chain</span>
        <span style={{ fontWeight: 800 }}>{chainId ?? '—'}</span>
      </span>

      {!isConnected ? (
        <button
          className="btn primary"
          disabled={isConnecting}
          onClick={() => connect({ connector: injected() })}
          title="Connect injected wallet (window.ethereum)"
        >
          {isConnecting ? 'Connecting…' : 'Connect'}
        </button>
      ) : (
        <Button variant="danger" onClick={() => disconnect()}>
          Disconnect
        </Button>
      )}

      {connectError ? (
        <span className="status bad">{String((connectError as any).message ?? connectError)}</span>
      ) : null}
    </div>
  )
}
