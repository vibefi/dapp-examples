import * as React from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { AAVE } from '../aave'
import { Card } from '../ui'
import { formatHealthFactor, formatUnits, hfColor } from '../format'

const BASE_DECIMALS = 8

function fmtBase(x?: bigint) {
  if (x === undefined) return '—'
  return formatUnits(x, BASE_DECIMALS, 6)
}

export function AccountOverview() {
  const { address, isConnected } = useAccount()

  const { data, isLoading, error } = useReadContract({
    address: AAVE.pool.address,
    abi: AAVE.pool.abi,
    functionName: 'getUserAccountData',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(isConnected && address) },
  })

  type AccountDataTuple = readonly [
    bigint, // totalCollateralBase
    bigint, // totalDebtBase
    bigint, // availableBorrowsBase
    bigint, // currentLiquidationThreshold
    bigint, // ltv
    bigint // healthFactor
  ]

  const tuple = Array.isArray(data) && data.length === 6 ? (data as unknown as AccountDataTuple) : undefined

  const d = tuple
    ? {
        totalCollateralBase: tuple[0],
        totalDebtBase: tuple[1],
        availableBorrowsBase: tuple[2],
        currentLiquidationThreshold: tuple[3],
        ltv: tuple[4],
        healthFactor: tuple[5],
      }
    : undefined

  console.log('account data', { data, error })

  const hf = d?.healthFactor ?? 0n
  const hfClass = hfColor(hf)

  return (
    <Card title="Your supplies" right={<span className="pill muted">Read-only RPC</span>}>
      {!isConnected ? <div className="muted small">Connect your wallet to load account data.</div> : null}
      {isLoading ? <div className="muted small">Loading…</div> : null}
      {error ? <div className="bad small">Error: {String((error as any).message ?? error)}</div> : null}

      <div className="kpi topGap">
        <div className="item">
          <div className="label">Total collateral (base currency)</div>
          <div className="value">{fmtBase(d?.totalCollateralBase)}</div>
        </div>
        <div className="item">
          <div className="label">Total debt (base currency)</div>
          <div className="value">{fmtBase(d?.totalDebtBase)}</div>
        </div>
        <div className="item">
          <div className="label">Available borrows (base currency)</div>
          <div className="value">{fmtBase(d?.availableBorrowsBase)}</div>
        </div>
        <div className="item">
          <div className="label">Health factor</div>
          <div className={`value ${hfClass}`}>{formatHealthFactor(hf, 4)}</div>
          <div className="small muted">Liquidation risk if &lt; 1.0</div>
        </div>
      </div>

      <div className="hr" />

      <div className="small muted">
        Notes: collateral/debt/borrows are returned in Aave’s market “base currency” (typically 8 decimals). Health
        factor is 18 decimals.
      </div>
    </Card>
  )
}
