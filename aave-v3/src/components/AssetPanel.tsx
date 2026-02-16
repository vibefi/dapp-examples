import * as React from 'react'
import { useMemo, useState } from 'react'
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { AAVE, RATE_MODE } from '../aave'
import { ADDRESSES, getAsset, getAssetSymbols, isEthSymbol, type Address } from '../addresses'
import { Card, Button, Input, Label, Select } from '../ui'
import { formatUnits, parseUnits } from '../format'
import { maxUint256 } from 'viem'

type Mode = 'Supply' | 'Withdraw' | 'Borrow' | 'Repay'

export function AssetPanel() {
  const { address, isConnected } = useAccount()
  const symbols = useMemo(() => getAssetSymbols(), [])
  const [symbol, setSymbol] = useState(symbols.includes('ETH') ? 'ETH' : (symbols[0] ?? 'WETH'))
  const [mode, setMode] = useState<Mode>('Supply')
  const [amountStr, setAmountStr] = useState('')

  const isEth = isEthSymbol(symbol)
  const asset = getAsset(symbol) // ETH maps to WETH address for reserve data
  const assetAddr = asset.address as Address
  const poolAddr = ADDRESSES.aaveV3.pool as Address
  const gatewayAddr = ADDRESSES.aaveV3.wrappedTokenGateway as Address

  // Native ETH balance (only used when symbol=ETH)
  const ethBal = useBalance({
    address: address,
    query: { enabled: Boolean(isConnected && address && isEth) },
  })

  // ERC20 wallet balance (used for non-ETH symbols, and for WETH specifically)
  const tokenBal = useReadContract({
    address: assetAddr,
    abi: AAVE.erc20.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(isConnected && address && !isEth) },
  })

  // Allowance to Pool (not needed for ETH-native)
  const allowance = useReadContract({
    address: assetAddr,
    abi: AAVE.erc20.abi,
    functionName: 'allowance',
    args: address ? [address, poolAddr] : undefined,
    query: { enabled: Boolean(isConnected && address && !isEth) },
  })

  // Aave user reserve data: for ETH, we read WETH reserve (since Aave reserve is WETH)
  const userReserve = useReadContract({
    address: ADDRESSES.aaveV3.protocolDataProvider as Address,
    abi: AAVE.dataProvider.abi,
    functionName: 'getUserReserveData',
    args: address ? [assetAddr, address] : undefined,
    query: { enabled: Boolean(isConnected && address) },
  })

  const reserve = userReserve.data as
    | {
        currentATokenBalance: bigint
        currentStableDebt: bigint
        currentVariableDebt: bigint
        principalStableDebt: bigint
        scaledVariableDebt: bigint
        stableBorrowRate: bigint
        liquidityRate: bigint
        stableRateLastUpdated: number
        usageAsCollateralEnabled: boolean
      }
    | undefined

  const walletBal = isEth ? (ethBal.data?.value ?? 0n) : ((tokenBal.data as bigint | undefined) ?? 0n)
  const poolAllowance = isEth ? 0n : ((allowance.data as bigint | undefined) ?? 0n)
  const supplied = reserve?.currentATokenBalance ?? 0n
  const variableDebt = reserve?.currentVariableDebt ?? 0n

  const amount = (() => {
    try {
      return parseUnits(amountStr || '0', asset.decimals)
    } catch {
      return 0n
    }
  })()

  const modeAllowed =
    !isEth || (mode === 'Supply' || mode === 'Withdraw') // ETH-native only supports supply/withdraw via gateway

  const needsApproval = !isEth && (mode === 'Supply' || mode === 'Repay')
  const approvalOk = !needsApproval || poolAllowance >= amount

  const { data: txHash, isPending, writeContract, error: writeError } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash: txHash })

  function setMaxForMode() {
    if (mode === 'Supply' || mode === 'Repay') {
      setAmountStr(formatUnits(walletBal, asset.decimals, 6))
    } else if (mode === 'Withdraw') {
      setAmountStr(formatUnits(supplied, asset.decimals, 6))
    } else if (mode === 'Borrow') {
      setAmountStr('')
    }
  }

  function onApprove() {
    if (!isConnected || !address) return
    if (isEth) return
    writeContract({
      address: assetAddr,
      abi: AAVE.erc20.abi,
      functionName: 'approve',
      args: [poolAddr, maxUint256],
    })
  }

  function onExecute() {
    if (!isConnected || !address) return
    if (amount <= 0n) throw new Error('Enter an amount')

    if (isEth) {
      if (mode === 'Supply') {
        // ETH-native deposit via WrappedTokenGateway => Aave mints aWETH
        writeContract({
          address: gatewayAddr,
          abi: AAVE.gateway.abi,
          functionName: 'depositETH',
          args: [poolAddr, address, 0],
          value: amount,
        })
        return
      }
      if (mode === 'Withdraw') {
        // Withdraw ETH-native via gateway; burns aWETH
        writeContract({
          address: gatewayAddr,
          abi: AAVE.gateway.abi,
          functionName: 'withdrawETH',
          args: [poolAddr, amount, address],
        })
        return
      }
      throw new Error('ETH-native only supports Supply/Withdraw. Use WETH for Borrow/Repay.')
    }

    if (mode === 'Supply') {
      writeContract({
        address: poolAddr,
        abi: AAVE.pool.abi,
        functionName: 'supply',
        args: [assetAddr, amount, address, 0],
      })
      return
    }

    if (mode === 'Withdraw') {
      writeContract({
        address: poolAddr,
        abi: AAVE.pool.abi,
        functionName: 'withdraw',
        args: [assetAddr, amount, address],
      })
      return
    }

    if (mode === 'Borrow') {
      writeContract({
        address: poolAddr,
        abi: AAVE.pool.abi,
        functionName: 'borrow',
        args: [assetAddr, amount, RATE_MODE.Variable, 0, address],
      })
      return
    }

    if (mode === 'Repay') {
      writeContract({
        address: poolAddr,
        abi: AAVE.pool.abi,
        functionName: 'repay',
        args: [assetAddr, amount, RATE_MODE.Variable, address],
      })
      return
    }
  }

  return (
    <Card title="Assets to supply or borrow">
      <div className="two">
        <div>
          <Label>Asset</Label>
          <Select
            value={symbol}
            onChange={(e) => {
              const next = e.target.value
              setSymbol(next)
              // If ETH selected, force to allowed mode
              if (isEthSymbol(next) && (mode === 'Borrow' || mode === 'Repay')) setMode('Supply')
            }}
          >
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Action</Label>
          <Select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            disabled={isEth}
            title={isEth ? 'ETH-native supports Supply/Withdraw via WrappedTokenGateway. Use WETH for Borrow/Repay.' : ''}
          >
            <option>Supply</option>
            <option>Withdraw</option>
            <option>Borrow</option>
            <option>Repay</option>
          </Select>
          {isEth ? <div className="small muted topTiny">ETH-native: Supply/Withdraw only (gateway).</div> : null}
        </div>
      </div>

      <div className="topGapSm">
        <Label>Amount</Label>
        <div className="two">
          <Input
            placeholder={`e.g. 0.1`}
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            inputMode="decimal"
          />
          <Button onClick={setMaxForMode} disabled={!isConnected}>
            Max
          </Button>
        </div>
      </div>

      <div className="hr" />

      <div className="kpi">
        <div className="item">
          <div className="label">Wallet balance</div>
          <div className="value">
            {formatUnits(walletBal, asset.decimals, 6)} {symbol}
          </div>
        </div>

        <div className="item">
          <div className="label">Pool allowance</div>
          <div className="value">
            {isEth ? '—' : `${formatUnits(poolAllowance, asset.decimals, 6)} ${symbol}`}
          </div>
          {isEth ? <div className="small muted">Not needed for ETH-native.</div> : null}
        </div>

        <div className="item">
          <div className="label">Supplied (aToken balance)</div>
          <div className="value">
            {formatUnits(supplied, asset.decimals, 6)} {isEth ? 'aWETH' : `a${symbol}`}
          </div>
          {isEth ? <div className="small muted">ETH deposits mint aWETH.</div> : null}
        </div>

        <div className="item">
          <div className="label">Variable debt</div>
          <div className="value">
            {formatUnits(variableDebt, asset.decimals, 6)} {isEth ? 'WETH' : symbol}
          </div>
        </div>
      </div>

      <div className="hr" />

      <div className="actions">
        {!modeAllowed ? (
          <div className="bad small">This action isn’t available for ETH-native. Switch to WETH.</div>
        ) : null}

        {needsApproval ? (
          <div className="two">
            <Button variant="default" onClick={onApprove} disabled={!isConnected || isPending} title="Approve max allowance for the Aave Pool">
              Approve
            </Button>

            <Button
              variant="primary"
              onClick={onExecute}
              disabled={!isConnected || isPending || (needsApproval && !approvalOk)}
              title={!approvalOk ? 'Approve first (or lower amount)' : 'Send transaction'}
            >
              Execute
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            onClick={onExecute}
            disabled={!isConnected || isPending || !modeAllowed}
          >
            Execute
          </Button>
        )}

        {writeError ? <div className="bad small">Tx error: {String((writeError as any).message ?? writeError)}</div> : null}

        {txHash ? (
          <div className="small">
            <div className="muted">
              Tx hash: <code className="inline">{String(txHash)}</code>
            </div>
            <div className="muted">
              Status: {receipt.isLoading ? 'confirming…' : receipt.isSuccess ? 'confirmed' : receipt.isError ? 'failed' : '—'}
            </div>
          </div>
        ) : null}

        {mode === 'Borrow' ? (
          <div className="small muted">
            Borrow “max” is not computed (would require price oracle + LTV math). Enter an explicit amount.
          </div>
        ) : null}

        {isEth ? (
          <div className="small muted">
            ETH-native actions use <span className="inlineStrong">WrappedTokenGateway</span>:
            depositETH (payable) and withdrawETH. Use WETH if you want Borrow/Repay.
          </div>
        ) : null}
      </div>
    </Card>
  )
}
