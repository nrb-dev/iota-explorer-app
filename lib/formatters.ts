const IOTA_DECIMALS = 9;

export function formatIota(raw: string): string {
  const n = Number(raw) / 10 ** IOTA_DECIMALS;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

export function formatApy(apy: number | null): string {
  if (apy == null) return '—';
  return `${(apy * 100).toFixed(2)}%`;
}

export function formatCommission(rate: number): string {
  // Commission rate is in basis points (10000 = 100%)
  return `${(rate / 100).toFixed(1)}%`;
}

export function formatVotingPower(power: number, total: number): string {
  if (total === 0) return '0%';
  return `${((power / total) * 100).toFixed(2)}%`;
}
