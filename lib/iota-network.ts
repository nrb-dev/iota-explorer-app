export const IOTA_NETWORKS = ['mainnet', 'testnet'] as const;

export type IotaNetwork = (typeof IOTA_NETWORKS)[number];

export const IOTA_NETWORK_LABELS = {
  mainnet: 'Mainnet',
  testnet: 'Testnet',
} satisfies Record<IotaNetwork, string>;

export function isIotaNetwork(value: unknown): value is IotaNetwork {
  return value === 'mainnet' || value === 'testnet';
}

export function parseIotaNetwork(
  value: string | null | undefined
): IotaNetwork {
  return isIotaNetwork(value) ? value : 'mainnet';
}

export function withNetworkParam(path: string, network: IotaNetwork): string {
  const [pathAndQuery, hash] = path.split('#', 2);
  const [pathname, query] = pathAndQuery.split('?', 2);
  const params = new URLSearchParams(query);
  params.set('network', network);
  const search = params.toString();

  return `${pathname}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`;
}
