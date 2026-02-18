import type { Address, Hex } from "viem";

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

export type SafeExecutionLog = {
  logIndex: number;
  address: Address;
  topics: Hex[];
  data: Hex;
  decodedEvent: string | null;
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
  allLogs: SafeExecutionLog[];
  timestampMs: number | null;
};

export type SafeHistoryQuery = {
  fromBlock?: bigint;
  toBlock?: bigint;
  lookbackBlocks?: bigint;
  limit?: number;
};

export type SafeTransactionPayload = {
  to: Address;
  value: bigint;
  data: Hex;
  operation: SafeOperation;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: Address;
  refundReceiver: Address;
  nonce: bigint;
};

export type SafeProposalSignature = {
  owner: Address;
  signature: Hex;
};

export type SafeProposedTransaction = {
  id: string;
  createdAtMs: number;
  updatedAtMs: number;
  chainId: number;
  safeAddress: Address;
  safeTxHash: Hex;
  title: string;
  description: string | null;
  tx: SafeTransactionPayload;
  signatures: SafeProposalSignature[];
  executedTxHash: Hex | null;
  executedAtMs: number | null;
};

export type SharedSafeProposalPayload = {
  version: 1;
  chainId: number;
  safeAddress: Address;
  safeTxHash: Hex;
  title?: string;
  description?: string | null;
  tx: {
    to: Address;
    value: string;
    data: Hex;
    operation: SafeOperation;
    safeTxGas: string;
    baseGas: string;
    gasPrice: string;
    gasToken: Address;
    refundReceiver: Address;
    nonce: string;
  };
  signatures: SafeProposalSignature[];
};
