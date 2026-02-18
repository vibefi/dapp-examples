import vibefi from "../vibefi.json";

export type Address = `0x${string}`;
export const SUPPORTED_CHAIN_IDS = [1, 11155111] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

type Asset = { address: Address; decimals: number };

type NetworkAddressesJson = {
  AaveV3Pool: Address;
  AaveV3PoolAddressesProvider: Address;
  AaveV3ProtocolDataProvider: Address;
  AaveV3UiPoolDataProvider?: Address;
  AaveV3WrappedTokenGateway: Address;
  WETH: Address;
  USDC: Address;
  DAI: Address;
};

type AddressesJson = {
  mainnet: NetworkAddressesJson;
  sepolia: NetworkAddressesJson;
};

export type ChainAddresses = {
  chainId: SupportedChainId;
  chainLabel: string;
  marketLabel: string;
  aaveV3: {
    pool: Address;
    poolAddressesProvider: Address;
    protocolDataProvider: Address;
    uiPoolDataProvider?: Address;
    wrappedTokenGateway: Address;
  };
  assets: Record<string, Asset>;
};

const json = (vibefi as { addresses: AddressesJson }).addresses;

const ADDRESSES_BY_CHAIN: Record<SupportedChainId, ChainAddresses> = {
  1: {
    chainId: 1,
    chainLabel: "Ethereum Mainnet",
    marketLabel: "Aave V3 Mainnet Market",
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
  },
  11155111: {
    chainId: 11155111,
    chainLabel: "Ethereum Sepolia",
    marketLabel: "Aave V3 Sepolia Market",
    aaveV3: {
      pool: json.sepolia.AaveV3Pool,
      poolAddressesProvider: json.sepolia.AaveV3PoolAddressesProvider,
      protocolDataProvider: json.sepolia.AaveV3ProtocolDataProvider,
      uiPoolDataProvider: json.sepolia.AaveV3UiPoolDataProvider,
      wrappedTokenGateway: json.sepolia.AaveV3WrappedTokenGateway,
    },
    assets: {
      ETH: { address: json.sepolia.WETH, decimals: 18 },
      WETH: { address: json.sepolia.WETH, decimals: 18 },
      USDC: { address: json.sepolia.USDC, decimals: 6 },
      DAI: { address: json.sepolia.DAI, decimals: 18 },
    },
  },
};

export function isSupportedChainId(chainId?: number): chainId is SupportedChainId {
  return chainId === 1 || chainId === 11155111;
}

export function getAddresses(chainId?: number): ChainAddresses | undefined {
  if (!isSupportedChainId(chainId)) return undefined;
  return ADDRESSES_BY_CHAIN[chainId];
}

export function getAssetSymbols(chainId?: number): string[] {
  const addresses = getAddresses(chainId);
  return addresses ? Object.keys(addresses.assets) : [];
}

export function getAsset(chainId: number | undefined, symbol: string): Asset | undefined {
  const addresses = getAddresses(chainId);
  if (!addresses) return undefined;
  return addresses.assets[symbol];
}

export function getChainLabel(chainId?: number): string {
  if (!chainId) return "Not connected";
  return getAddresses(chainId)?.chainLabel ?? "Unsupported chain";
}

export function getMarketLabel(chainId?: number): string {
  if (!chainId) return "Aave V3 market";
  return getAddresses(chainId)?.marketLabel ?? "Unsupported network";
}

export function isEthSymbol(symbol: string) {
  return symbol.toUpperCase() === "ETH";
}
