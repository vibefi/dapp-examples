import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { maxUint256 } from "viem";
import { AAVE, RATE_MODE } from "../aave";
import {
  SUPPORTED_CHAIN_IDS,
  getAddresses,
  getAsset,
  getAssetSymbols,
  isEthSymbol,
  type Address,
} from "../addresses";
import { formatUnits, parseUnits } from "../format";
import { Button } from "./Button";
import { Card } from "./Card";
import { Input } from "./Input";
import { Label } from "./Label";
import { Select } from "./Select";

type Mode = "Supply" | "Withdraw" | "Borrow" | "Repay";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export function AssetPanel() {
  const { address, isConnected, chainId } = useAccount();
  const addresses = getAddresses(chainId);
  const isSupportedChain = Boolean(addresses);
  const supportedChainHint = SUPPORTED_CHAIN_IDS.join(", ");
  const symbols = useMemo(() => getAssetSymbols(chainId), [chainId]);
  const defaultSymbol = symbols.includes("ETH") ? "ETH" : (symbols[0] ?? "WETH");
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [mode, setMode] = useState<Mode>("Supply");
  const [amountStr, setAmountStr] = useState("");

  useEffect(() => {
    if (!symbols.includes(symbol)) setSymbol(defaultSymbol);
  }, [defaultSymbol, symbol, symbols]);

  const isEth = isEthSymbol(symbol);
  const asset = getAsset(chainId, symbol);
  const assetDecimals = asset?.decimals ?? 18;
  const assetAddr = (asset?.address ?? ZERO_ADDRESS) as Address;
  const poolAddr = (addresses?.aaveV3.pool ?? ZERO_ADDRESS) as Address;
  const gatewayAddr = (addresses?.aaveV3.wrappedTokenGateway ?? ZERO_ADDRESS) as Address;
  const dataProviderAddr = (addresses?.aaveV3.protocolDataProvider ?? ZERO_ADDRESS) as Address;
  const readsEnabled = Boolean(isConnected && address && isSupportedChain && asset);

  // Native ETH balance (only used when symbol=ETH)
  const ethBal = useBalance({
    address,
    query: { enabled: Boolean(readsEnabled && isEth) },
  });

  // ERC20 wallet balance (used for non-ETH symbols, and for WETH specifically)
  const tokenBal = useReadContract({
    address: assetAddr,
    abi: AAVE.erc20.abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(readsEnabled && !isEth) },
  });

  // Allowance to Pool (not needed for ETH-native)
  const allowance = useReadContract({
    address: assetAddr,
    abi: AAVE.erc20.abi,
    functionName: "allowance",
    args: address ? [address, poolAddr] : undefined,
    query: { enabled: Boolean(readsEnabled && !isEth) },
  });

  // Aave user reserve data: for ETH, we read WETH reserve (since Aave reserve is WETH)
  const userReserve = useReadContract({
    address: dataProviderAddr,
    abi: AAVE.dataProvider.abi,
    functionName: "getUserReserveData",
    args: address ? [assetAddr, address] : undefined,
    query: { enabled: readsEnabled },
  });

  const reserve = userReserve.data as
    | {
        currentATokenBalance: bigint;
        currentStableDebt: bigint;
        currentVariableDebt: bigint;
        principalStableDebt: bigint;
        scaledVariableDebt: bigint;
        stableBorrowRate: bigint;
        liquidityRate: bigint;
        stableRateLastUpdated: number;
        usageAsCollateralEnabled: boolean;
      }
    | undefined;

  const walletBal = isEth ? (ethBal.data?.value ?? 0n) : ((tokenBal.data as bigint | undefined) ?? 0n);
  const poolAllowance = isEth ? 0n : ((allowance.data as bigint | undefined) ?? 0n);
  const supplied = reserve?.currentATokenBalance ?? 0n;
  const variableDebt = reserve?.currentVariableDebt ?? 0n;

  const amount = (() => {
    try {
      return parseUnits(amountStr || "0", assetDecimals);
    } catch {
      return 0n;
    }
  })();

  const modeAllowed =
    isSupportedChain && (!isEth || mode === "Supply" || mode === "Withdraw"); // ETH-native only supports supply/withdraw via gateway

  const needsApproval = isSupportedChain && !isEth && (mode === "Supply" || mode === "Repay");
  const approvalOk = !needsApproval || poolAllowance >= amount;

  const { data: txHash, isPending, writeContract, error: writeError } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  function setMaxForMode() {
    if (mode === "Supply" || mode === "Repay") {
      setAmountStr(formatUnits(walletBal, assetDecimals, 6));
    } else if (mode === "Withdraw") {
      setAmountStr(formatUnits(supplied, assetDecimals, 6));
    } else if (mode === "Borrow") {
      setAmountStr("");
    }
  }

  function onApprove() {
    if (!isConnected || !address || !isSupportedChain || !asset) return;
    if (isEth) return;
    writeContract({
      address: assetAddr,
      abi: AAVE.erc20.abi,
      functionName: "approve",
      args: [poolAddr, maxUint256],
    });
  }

  function onExecute() {
    if (!isConnected || !address || !isSupportedChain || !asset) return;
    if (!modeAllowed) throw new Error("Action unavailable for selected asset on this network.");
    if (amount <= 0n) throw new Error("Enter an amount");

    if (isEth) {
      if (mode === "Supply") {
        // ETH-native deposit via WrappedTokenGateway => Aave mints aWETH
        writeContract({
          address: gatewayAddr,
          abi: AAVE.gateway.abi,
          functionName: "depositETH",
          args: [poolAddr, address, 0],
          value: amount,
        });
        return;
      }
      if (mode === "Withdraw") {
        // Withdraw ETH-native via gateway; burns aWETH
        writeContract({
          address: gatewayAddr,
          abi: AAVE.gateway.abi,
          functionName: "withdrawETH",
          args: [poolAddr, amount, address],
        });
        return;
      }
      throw new Error("ETH-native only supports Supply/Withdraw. Use WETH for Borrow/Repay.");
    }

    if (mode === "Supply") {
      writeContract({
        address: poolAddr,
        abi: AAVE.pool.abi,
        functionName: "supply",
        args: [assetAddr, amount, address, 0],
      });
      return;
    }

    if (mode === "Withdraw") {
      writeContract({
        address: poolAddr,
        abi: AAVE.pool.abi,
        functionName: "withdraw",
        args: [assetAddr, amount, address],
      });
      return;
    }

    if (mode === "Borrow") {
      writeContract({
        address: poolAddr,
        abi: AAVE.pool.abi,
        functionName: "borrow",
        args: [assetAddr, amount, RATE_MODE.Variable, 0, address],
      });
      return;
    }

    if (mode === "Repay") {
      writeContract({
        address: poolAddr,
        abi: AAVE.pool.abi,
        functionName: "repay",
        args: [assetAddr, amount, RATE_MODE.Variable, address],
      });
      return;
    }
  }

  return (
    <Card title="Assets to supply or borrow">
      {isConnected && !isSupportedChain ? (
        <div className="bad small topGapSm">
          Unsupported chain {chainId}. Switch wallet network to chain ID {supportedChainHint}.
        </div>
      ) : null}

      <div className="two topGapSm">
        <div>
          <Label>Asset</Label>
          <Select
            value={symbol}
            onChange={(e) => {
              const next = e.target.value;
              setSymbol(next);
              // If ETH selected, force to allowed mode
              if (isEthSymbol(next) && (mode === "Borrow" || mode === "Repay")) setMode("Supply");
            }}
            disabled={!isSupportedChain || symbols.length === 0}
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
            disabled={isEth || !isSupportedChain}
            title={isEth ? "ETH-native supports Supply/Withdraw via WrappedTokenGateway. Use WETH for Borrow/Repay." : ""}
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
            placeholder="e.g. 0.1"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            inputMode="decimal"
            disabled={!isSupportedChain}
          />
          <Button onClick={setMaxForMode} disabled={!isConnected || !isSupportedChain}>
            Max
          </Button>
        </div>
      </div>

      <div className="hr" />

      <div className="kpi">
        <div className="item">
          <div className="label">Wallet balance</div>
          <div className="value">
            {formatUnits(walletBal, assetDecimals, 6)} {symbol}
          </div>
        </div>

        <div className="item">
          <div className="label">Pool allowance</div>
          <div className="value">
            {isEth ? "—" : `${formatUnits(poolAllowance, assetDecimals, 6)} ${symbol}`}
          </div>
          {isEth ? <div className="small muted">Not needed for ETH-native.</div> : null}
        </div>

        <div className="item">
          <div className="label">Supplied (aToken balance)</div>
          <div className="value">
            {formatUnits(supplied, assetDecimals, 6)} {isEth ? "aWETH" : `a${symbol}`}
          </div>
          {isEth ? <div className="small muted">ETH deposits mint aWETH.</div> : null}
        </div>

        <div className="item">
          <div className="label">Variable debt</div>
          <div className="value">
            {formatUnits(variableDebt, assetDecimals, 6)} {isEth ? "WETH" : symbol}
          </div>
        </div>
      </div>

      <div className="hr" />

      <div className="actions">
        {!modeAllowed && isSupportedChain ? (
          <div className="bad small">This action isn't available for ETH-native. Switch to WETH.</div>
        ) : null}

        {needsApproval ? (
          <div className="two">
            <Button
              variant="default"
              onClick={onApprove}
              disabled={!isConnected || !isSupportedChain || isPending}
              title="Approve max allowance for the Aave Pool"
            >
              Approve
            </Button>

            <Button
              variant="primary"
              onClick={onExecute}
              disabled={!isConnected || !isSupportedChain || isPending || !modeAllowed || (needsApproval && !approvalOk)}
              title={!approvalOk ? "Approve first (or lower amount)" : "Send transaction"}
            >
              Execute
            </Button>
          </div>
        ) : (
          <Button variant="primary" onClick={onExecute} disabled={!isConnected || !isSupportedChain || isPending || !modeAllowed}>
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
              Status: {receipt.isLoading ? "confirming…" : receipt.isSuccess ? "confirmed" : receipt.isError ? "failed" : "—"}
            </div>
          </div>
        ) : null}

        {mode === "Borrow" ? (
          <div className="small muted">
            Borrow "max" is not computed (would require price oracle + LTV math). Enter an explicit amount.
          </div>
        ) : null}

        {isEth ? (
          <div className="small muted">
            ETH-native actions use <span className="inlineStrong">WrappedTokenGateway</span>: depositETH (payable) and
            withdrawETH. Use WETH if you want Borrow/Repay.
          </div>
        ) : null}
      </div>
    </Card>
  );
}
