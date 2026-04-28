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

export function formatAddress(address: string, size = 6): string {
  if (!address) return '—';
  if (address.length <= size * 2 + 3) return address;
  return `${address.slice(0, size)}...${address.slice(-size)}`;
}

export function formatCompactNumber(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(n);
}
