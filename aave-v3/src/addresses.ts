import raw from '../addresses.json'

export type Address = `0x${string}`

type AddressesJson = {
  mainnet: Record<string, Address>
}

type Asset = { address: Address; decimals: number }
type Addresses = {
  chainId: number
  aaveV3: {
    pool: Address
    poolAddressesProvider: Address
    protocolDataProvider: Address
    uiPoolDataProvider: Address
    wrappedTokenGateway: Address
  }
  assets: Record<string, Asset>
}

const json = raw as AddressesJson

export const ADDRESSES: Addresses = {
  chainId: 1,
  aaveV3: {
    pool: json.mainnet.AaveV3Pool,
    poolAddressesProvider: json.mainnet.AaveV3PoolAddressesProvider,
    protocolDataProvider: json.mainnet.AaveV3ProtocolDataProvider,
    uiPoolDataProvider: json.mainnet.AaveV3UiPoolDataProvider,
    wrappedTokenGateway: json.mainnet.AaveV3WrappedTokenGateway,
  },
  assets: {
    ETH: { address: json.mainnet.WETH, decimals: 18 },
    WETH: { address: json.mainnet.WETH, decimals: 18 },
    USDC: { address: json.mainnet.USDC, decimals: 6 },
    DAI: { address: json.mainnet.DAI, decimals: 18 },
  },
}

export function getAssetSymbols(): string[] {
  return Object.keys(ADDRESSES.assets)
}

export function getAsset(symbol: string): Asset {
  const a = ADDRESSES.assets[symbol]
  if (!a) throw new Error(`Unknown asset: ${symbol}`)
  return a
}

export function isEthSymbol(symbol: string) {
  return symbol.toUpperCase() === 'ETH'
}
