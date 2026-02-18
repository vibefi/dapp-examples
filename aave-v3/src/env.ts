export function getRpcUrl(): string {
  // Vite typically exposes only VITE_* vars, but your environment says RPC_URL exists.
  const env = (import.meta as any).env ?? {};
  const rpc =
    env.RPC_URL ??
    env.VITE_RPC_URL ??
    env.VITE_PUBLIC_RPC_URL ??
    env.PUBLIC_RPC_URL;

  return rpc;
}
