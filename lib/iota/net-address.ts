const NETADDRESS_REGEX = /\/(ip4|dns|dns4)\/([^/]+)\//;

export function extractHost(netAddress: string | undefined): string | null {
  if (!netAddress) return null;
  const match = netAddress.match(NETADDRESS_REGEX);
  return match ? match[2] : null;
}
