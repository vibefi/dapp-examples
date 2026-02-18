export function clampStr(s: string, max = 10_000) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

const UINT256_MAX = (1n << 256n) - 1n;
const UINT256_MAX_LIKE_DELTA = 10n ** 24n;

export function shortenAddress(a?: string, lead = 6, tail = 4) {
  if (!a) return "";
  if (a.length <= lead + tail + 2) return a;
  return `${a.slice(0, lead + 2)}…${a.slice(-tail)}`;
}

export function formatUnits(value: bigint, decimals: number, precision = 6) {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, precision);
  const trimmed = fracStr.replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${trimmed ? "." + trimmed : ""}`;
}

export function parseUnits(input: string, decimals: number): bigint {
  const s = input.trim();
  if (!s) return 0n;
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Invalid number");
  const [w, f = ""] = s.split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(w) * 10n ** BigInt(decimals) + BigInt(frac || "0");
}

export function hfColor(hfRay: bigint) {
  const one = 10n ** 18n;
  if (hfRay === 0n) return "muted";
  if (hfRay < one) return "bad";
  if (hfRay < (15n * one) / 10n) return "warn";
  return "good";
}

export function isInfiniteLikeUint256(value: bigint) {
  return value >= UINT256_MAX - UINT256_MAX_LIKE_DELTA;
}

export function formatHealthFactor(hfRay: bigint, precision = 4) {
  if (isInfiniteLikeUint256(hfRay)) return "∞";
  return formatUnits(hfRay, 18, precision);
}
