import { decodeEventLog, decodeFunctionData, getAddress, type Address, type Hex } from "viem";
import { ABI } from "./abis";
import type {
  DecodedErc20Call,
  DecodedErc20TransferLog,
  DecodedExecTransaction,
  SafeClient,
  SafeExecutionHistoryItem,
  SafeHistoryQuery,
  SafeOverview,
  TokenMetadata,
} from "./types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const DEFAULT_LOG_CHUNK_SIZE = 50_000n;
export const DEFAULT_HISTORY_LOOKBACK_BLOCKS = 250_000n;

const ERC20_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "Transfer",
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
] as const;

type TokenMetadataCache = Map<Address, Promise<TokenMetadata | null>>;
type DecodedErc20CallWithoutToken =
  | {
      method: "transfer";
      to: Address;
      amount: bigint;
    }
  | {
      method: "transferFrom";
      from: Address;
      to: Address;
      amount: bigint;
    }
  | {
      method: "approve";
      spender: Address;
      amount: bigint;
    };

type ExecutionSuccessLog = {
  blockNumber: bigint | null;
  transactionHash: Hex | null;
  args?: { txHash?: Hex; payment?: bigint };
  logIndex: number | null;
};

function asSafeAddress(value: string): Address {
  return getAddress(value.trim());
}

function asNullableAddress(value: unknown): Address | null {
  if (typeof value !== "string") return null;
  if (value.toLowerCase() === ZERO_ADDRESS) return null;
  return getAddress(value);
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNullableDecimals(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") {
    const asNum = Number(value);
    return Number.isFinite(asNum) ? asNum : null;
  }
  return null;
}

async function getClientChainId(client: SafeClient): Promise<number> {
  if (client.chain?.id) return client.chain.id;
  return client.getChainId();
}

async function readVersion(client: SafeClient, safeAddress: Address): Promise<string | null> {
  try {
    return (await client.readContract({
      address: safeAddress,
      abi: ABI.safe,
      functionName: "VERSION",
    })) as string;
  } catch {
    return null;
  }
}

async function readGuard(client: SafeClient, safeAddress: Address): Promise<Address | null> {
  try {
    const guard = await client.readContract({
      address: safeAddress,
      abi: ABI.safe,
      functionName: "getGuard",
    });
    return asNullableAddress(guard);
  } catch {
    return null;
  }
}

async function readFallbackHandler(client: SafeClient, safeAddress: Address): Promise<Address | null> {
  try {
    const fallbackHandler = await client.readContract({
      address: safeAddress,
      abi: ABI.safe,
      functionName: "getFallbackHandler",
    });
    return asNullableAddress(fallbackHandler);
  } catch {
    return null;
  }
}

async function readModules(client: SafeClient, safeAddress: Address): Promise<Address[]> {
  try {
    const result = (await client.readContract({
      address: safeAddress,
      abi: ABI.safe,
      functionName: "getModulesPaginated",
      args: [ZERO_ADDRESS, 25n],
    })) as [Address[], Address];

    return result[0].map((moduleAddress) => getAddress(moduleAddress));
  } catch {
    return [];
  }
}

function decodeErc20CallData(data: Hex): DecodedErc20CallWithoutToken | null {
  try {
    const decoded = decodeFunctionData({ abi: ERC20_ABI, data });

    if (decoded.functionName === "transfer") {
      const [to, amount] = decoded.args as [Address, bigint];
      return {
        method: "transfer",
        to: getAddress(to),
        amount,
      };
    }

    if (decoded.functionName === "transferFrom") {
      const [from, to, amount] = decoded.args as [Address, Address, bigint];
      return {
        method: "transferFrom",
        from: getAddress(from),
        to: getAddress(to),
        amount,
      };
    }

    if (decoded.functionName === "approve") {
      const [spender, amount] = decoded.args as [Address, bigint];
      return {
        method: "approve",
        spender: getAddress(spender),
        amount,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function readTokenMetadata(
  client: SafeClient,
  tokenAddressInput: Address,
  cache: TokenMetadataCache,
): Promise<TokenMetadata | null> {
  const tokenAddress = getAddress(tokenAddressInput);
  const existing = cache.get(tokenAddress);
  if (existing) return existing;

  const pending = (async (): Promise<TokenMetadata | null> => {
    const bytecode = await client.getBytecode({ address: tokenAddress });
    if (!bytecode || bytecode === "0x") return null;

    const [name, symbol, decimalsRaw] = await Promise.all([
      client
        .readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "name",
        })
        .then(asNullableString)
        .catch(() => null),
      client
        .readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "symbol",
        })
        .then(asNullableString)
        .catch(() => null),
      client
        .readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "decimals",
        })
        .then(asNullableDecimals)
        .catch(() => null),
    ]);

    if (name === null && symbol === null && decimalsRaw === null) return null;

    return {
      address: tokenAddress,
      name,
      symbol,
      decimals: decimalsRaw,
    };
  })();

  cache.set(tokenAddress, pending);
  return pending;
}

function withTokenMetadata(
  call: DecodedErc20CallWithoutToken,
  token: TokenMetadata | null,
): DecodedErc20Call {
  if (call.method === "transfer") {
    return {
      method: "transfer",
      token,
      to: call.to,
      amount: call.amount,
    };
  }
  if (call.method === "transferFrom") {
    return {
      method: "transferFrom",
      token,
      from: call.from,
      to: call.to,
      amount: call.amount,
    };
  }
  return {
    method: "approve",
    token,
    spender: call.spender,
    amount: call.amount,
  };
}

async function decodeErc20TransferLogs(
  client: SafeClient,
  receiptLogs: readonly { address: Address; data: Hex; topics: readonly Hex[] }[],
  tokenCache: TokenMetadataCache,
): Promise<DecodedErc20TransferLog[]> {
  const transfers: DecodedErc20TransferLog[] = [];

  for (const log of receiptLogs) {
    try {
      const decoded = decodeEventLog({
        abi: ERC20_ABI,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });

      if (decoded.eventName !== "Transfer") continue;

      const args = decoded.args as { from: Address; to: Address; value: bigint };
      const token = await readTokenMetadata(client, getAddress(log.address), tokenCache);

      transfers.push({
        token,
        from: getAddress(args.from),
        to: getAddress(args.to),
        amount: args.value,
      });
    } catch {
      continue;
    }
  }

  return transfers;
}

export async function isSafeContract(client: SafeClient, safeAddressInput: string): Promise<boolean> {
  let safeAddress: Address;
  try {
    safeAddress = asSafeAddress(safeAddressInput);
  } catch {
    return false;
  }

  const bytecode = await client.getBytecode({ address: safeAddress });
  if (!bytecode || bytecode === "0x") return false;

  try {
    await client.readContract({
      address: safeAddress,
      abi: ABI.safe,
      functionName: "getThreshold",
    });
    return true;
  } catch {
    return false;
  }
}

export async function loadSafeOverview(client: SafeClient, safeAddressInput: string): Promise<SafeOverview> {
  const safeAddress = asSafeAddress(safeAddressInput);
  const chainIdPromise = getClientChainId(client);

  const [ownersRaw, thresholdRaw, nonceRaw, balanceWei, version, guard, fallbackHandler, modules] = await Promise.all([
    client.readContract({
      address: safeAddress,
      abi: ABI.safe,
      functionName: "getOwners",
    }),
    client.readContract({
      address: safeAddress,
      abi: ABI.safe,
      functionName: "getThreshold",
    }),
    client.readContract({
      address: safeAddress,
      abi: ABI.safe,
      functionName: "nonce",
    }),
    client.getBalance({
      address: safeAddress,
    }),
    readVersion(client, safeAddress),
    readGuard(client, safeAddress),
    readFallbackHandler(client, safeAddress),
    readModules(client, safeAddress),
  ]);

  const owners = (ownersRaw as Address[]).map((owner) => getAddress(owner));
  const threshold = Number(thresholdRaw as bigint);
  if (!Number.isSafeInteger(threshold) || threshold < 0) {
    throw new Error(`Invalid Safe threshold: ${String(thresholdRaw)}`);
  }

  const chainId = await chainIdPromise;

  return {
    chainId,
    safeAddress,
    version,
    owners,
    threshold,
    nonce: nonceRaw as bigint,
    balanceWei,
    guard,
    fallbackHandler,
    modules,
  };
}

export function decodeExecTransactionData(data: Hex): DecodedExecTransaction | null {
  try {
    const decoded = decodeFunctionData({ abi: ABI.safe, data });
    if (decoded.functionName !== "execTransaction") return null;

    const [to, value, callData, rawOperation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures] = decoded.args as [
      Address,
      bigint,
      Hex,
      bigint | number,
      bigint,
      bigint,
      bigint,
      Address,
      Address,
      Hex,
    ];

    const operation = typeof rawOperation === "bigint" ? Number(rawOperation) : rawOperation;
    if (operation !== 0 && operation !== 1) return null;

    return {
      to: getAddress(to),
      value,
      data: callData,
      operation,
      safeTxGas,
      baseGas,
      gasPrice,
      gasToken: getAddress(gasToken),
      refundReceiver: refundReceiver === ZERO_ADDRESS ? ZERO_ADDRESS : getAddress(refundReceiver),
      signatures,
    };
  } catch {
    return null;
  }
}

async function getExecutionSuccessLogsRange(
  client: SafeClient,
  safeAddress: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<ExecutionSuccessLog[]> {
  try {
    return await client.getLogs({
      address: safeAddress,
      event: {
        type: "event",
        name: "ExecutionSuccess",
        inputs: [
          { indexed: true, name: "txHash", type: "bytes32" },
          { indexed: false, name: "payment", type: "uint256" },
        ],
      },
      fromBlock,
      toBlock,
      strict: false,
    });
  } catch (error) {
    if (fromBlock >= toBlock) throw error;

    const midpoint = fromBlock + (toBlock - fromBlock) / 2n;
    const [left, right] = await Promise.all([
      getExecutionSuccessLogsRange(client, safeAddress, fromBlock, midpoint),
      getExecutionSuccessLogsRange(client, safeAddress, midpoint + 1n, toBlock),
    ]);
    return [...left, ...right];
  }
}

async function getExecutionSuccessLogsChunked(
  client: SafeClient,
  safeAddress: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<ExecutionSuccessLog[]> {
  const logs: ExecutionSuccessLog[] = [];

  for (let cursor = fromBlock; cursor <= toBlock; cursor += DEFAULT_LOG_CHUNK_SIZE + 1n) {
    const chunkTo = cursor + DEFAULT_LOG_CHUNK_SIZE > toBlock ? toBlock : cursor + DEFAULT_LOG_CHUNK_SIZE;
    const chunkLogs = await getExecutionSuccessLogsRange(client, safeAddress, cursor, chunkTo);
    logs.push(...chunkLogs);
  }

  return logs;
}

export async function loadSafeExecutionHistory(
  client: SafeClient,
  safeAddressInput: string,
  query: SafeHistoryQuery = {},
): Promise<SafeExecutionHistoryItem[]> {
  const safeAddress = asSafeAddress(safeAddressInput);
  const chainId = await getClientChainId(client);

  const latestBlock = query.toBlock ?? (await client.getBlockNumber());
  const lookbackBlocks = query.lookbackBlocks ?? DEFAULT_HISTORY_LOOKBACK_BLOCKS;
  const windowOffset = lookbackBlocks > 0n ? lookbackBlocks - 1n : 0n;
  const fromBlock = query.fromBlock ?? (latestBlock > windowOffset ? latestBlock - windowOffset : 0n);
  if (fromBlock > latestBlock) return [];

  const logs = await getExecutionSuccessLogsChunked(client, safeAddress, fromBlock, latestBlock);
  const sortedLogs = logs
    .filter((log) => log.blockNumber !== null && log.transactionHash !== null)
    .sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber! > b.blockNumber! ? -1 : 1;
      return (b.logIndex ?? 0) - (a.logIndex ?? 0);
    });

  const cappedLogs = typeof query.limit === "number" && query.limit > 0 ? sortedLogs.slice(0, query.limit) : sortedLogs;
  const tokenCache: TokenMetadataCache = new Map();

  const settled = await Promise.allSettled(
    cappedLogs.map(async (log) => {
      const transactionHash = log.transactionHash as Hex;
      const [transaction, block, receipt] = await Promise.all([
        client.getTransaction({ hash: transactionHash }),
        client.getBlock({ blockNumber: log.blockNumber as bigint }),
        client.getTransactionReceipt({ hash: transactionHash }),
      ]);

      const decodedExecTransaction = decodeExecTransactionData((transaction.input ?? "0x") as Hex);

      let targetContractToken: TokenMetadata | null = null;
      let decodedErc20Call: DecodedErc20Call | null = null;
      if (decodedExecTransaction) {
        targetContractToken = await readTokenMetadata(client, decodedExecTransaction.to, tokenCache);
        const erc20Call = decodeErc20CallData(decodedExecTransaction.data);
        if (erc20Call) {
          decodedErc20Call = withTokenMetadata(erc20Call, targetContractToken);
        }
      }

      const erc20Transfers = await decodeErc20TransferLogs(
        client,
        receipt.logs.map((entry) => ({
          address: getAddress(entry.address),
          data: (entry.data ?? "0x") as Hex,
          topics: entry.topics as Hex[],
        })),
        tokenCache,
      );

      return {
        chainId,
        safeAddress,
        blockNumber: log.blockNumber as bigint,
        transactionHash,
        safeTxHash: (log.args?.txHash ?? ZERO_BYTES32) as Hex,
        paymentWei: (log.args?.payment ?? 0n) as bigint,
        decodedExecTransaction,
        targetContractToken,
        decodedErc20Call,
        erc20Transfers,
        timestampMs: block.timestamp !== undefined ? Number(block.timestamp) * 1000 : null,
      } satisfies SafeExecutionHistoryItem;
    }),
  );

  return settled.flatMap((item) => (item.status === "fulfilled" ? [item.value] : []));
}
