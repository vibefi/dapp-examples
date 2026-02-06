import { ADDRESSES, type Address } from './addresses'
import { AAVE_POOL_ABI, AAVE_PROTOCOL_DATA_PROVIDER_ABI, ERC20_ABI, WRAPPED_TOKEN_GATEWAY_ABI } from './abis'

export const AAVE = {
  pool: { address: ADDRESSES.aaveV3.pool as Address, abi: AAVE_POOL_ABI },
  dataProvider: { address: ADDRESSES.aaveV3.protocolDataProvider as Address, abi: AAVE_PROTOCOL_DATA_PROVIDER_ABI },
  gateway: { address: ADDRESSES.aaveV3.wrappedTokenGateway as Address, abi: WRAPPED_TOKEN_GATEWAY_ABI },
  erc20: { abi: ERC20_ABI },
}

export const RATE_MODE = {
  Stable: 1n,
  Variable: 2n,
} as const
