import erc20 from '../abis/erc20.json'
import aavePool from '../abis/aavePool.json'
import aaveProtocolDataProvider from '../abis/aaveProtocolDataProvider.json'
import wrappedTokenGateway from '../abis/wrappedTokenGateway.json'

export const ERC20_ABI = erc20 as const
export const AAVE_POOL_ABI = aavePool as const
export const AAVE_PROTOCOL_DATA_PROVIDER_ABI = aaveProtocolDataProvider as const
export const WRAPPED_TOKEN_GATEWAY_ABI = wrappedTokenGateway as const
