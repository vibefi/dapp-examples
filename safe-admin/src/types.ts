import type { Address, Hex, PublicClient } from "viem";

export type SafeOperation = 0 | 1;

export type SafeOverview = {
  chainId: number;
  safeAddress: Address;
  version: string | null;
  owners: Address[];
  threshold: number;
  nonce: bigint;
  balanceWei: bigint;
  guard: Address | null;
  fallbackHandler: Address | null;
  modules: Address[];
};

export type DecodedExecTransaction = {
  to: Address;
  value: bigint;
  data: Hex;
  operation: SafeOperation;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: Address;
  refundReceiver: Address;
  signatures: Hex;
};

export type TokenMetadata = {
  address: Address;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
};

export type DecodedErc20Call =
  | {
      method: "transfer";
      token: TokenMetadata | null;
      to: Address;
      amount: bigint;
    }
  | {
      method: "transferFrom";
      token: TokenMetadata | null;
      from: Address;
      to: Address;
      amount: bigint;
    }
  | {
      method: "approve";
      token: TokenMetadata | null;
      spender: Address;
      amount: bigint;
    };

export type DecodedErc20TransferLog = {
  token: TokenMetadata | null;
  from: Address;
  to: Address;
  amount: bigint;
};

export type SafeExecutionHistoryItem = {
  chainId: number;
  safeAddress: Address;
  blockNumber: bigint;
  transactionHash: Hex;
  safeTxHash: Hex;
  paymentWei: bigint;
  decodedExecTransaction: DecodedExecTransaction | null;
  targetContractToken: TokenMetadata | null;
  decodedErc20Call: DecodedErc20Call | null;
  erc20Transfers: DecodedErc20TransferLog[];
  timestampMs: number | null;
};

export type SafeHistoryQuery = {
  fromBlock?: bigint;
  toBlock?: bigint;
  lookbackBlocks?: bigint;
  limit?: number;
};

export type SafeClient = PublicClient;
