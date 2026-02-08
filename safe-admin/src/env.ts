type EnvRecord = Record<string, string | undefined>;

function getEnv(): EnvRecord {
  return ((import.meta as unknown as { env?: EnvRecord }).env ?? {}) as EnvRecord;
}

export function getRpcUrl(): string | undefined {
  const env = getEnv();
  return env.RPC_URL ?? env.VITE_RPC_URL;
}

export function getConfiguredChainId(): number {
  const env = getEnv();
  const raw = env.CHAIN_ID ?? env.VITE_CHAIN_ID;
  if (!raw) return 1;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid CHAIN_ID value: ${raw}`);
  }

  return parsed;
}
