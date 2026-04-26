import { NextResponse } from 'next/server';
import dns from 'dns/promises';

export const dynamic = 'force-dynamic';

type GeoEntry = {
  lat: number;
  lng: number;
  region: string;
  country: string;
  city: string;
  cachedAt: number;
};

type ParsedNode = {
  name: string;
  description: string;
  imageUrl: string;
  projectUrl: string;
  host: string | null;
  votingPower: number;
  commissionRate: number;
  stakingPoolIotaBalance: string;
  nextEpochStake: string;
  gasPrice: string;
  rewardsPool: string;
  iotaAddress: string;
};

type ParsedNodeWithHost = ParsedNode & { host: string };

type ValidatorResponse = {
  name: string;
  description: string;
  imageUrl: string;
  projectUrl: string;
  region: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
  votingPower: number;
  commissionRate: number;
  stakingPoolIotaBalance: string;
  nextEpochStake: string;
  gasPrice: string;
  rewardsPool: string;
  iotaAddress: string;
  apy: number | null;
};

type ApiResponse = {
  epoch: string;
  totalStake: string;
  referenceGasPrice: string;
  validators: ValidatorResponse[];
};

const GEO_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_HOSTS_PER_BATCH = 100;
const IOTA_RPC_URL = process.env.IOTA_RPC_URL;
const IP_API_URL = process.env.IP_API_URL || 'http://ip-api.com/batch';
const IOTA_RPC_KEY = process.env.IOTA_RPC_KEY || '';

const NETADDRESS_REGEX = /\/(ip4|dns|dns4)\/([^/]+)\//;

const geoCache = new Map<string, GeoEntry>();

const isDev = process.env.NODE_ENV !== 'production';
const log = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};

const rpcHeaders: HeadersInit = {
  'Content-Type': 'application/json',
  ...(IOTA_RPC_KEY && { Authorization: `Bearer ${IOTA_RPC_KEY}` }),
};

function isCacheFresh(entry: GeoEntry): boolean {
  return Date.now() - entry.cachedAt < GEO_TTL_MS;
}

function extractHost(netAddress: string | undefined): string | null {
  if (!netAddress) return null;
  const match = netAddress.match(NETADDRESS_REGEX);
  return match ? match[2] : null;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function resolveHostsToIps(
  hosts: string[]
): Promise<{ ips: string[]; ipToHost: Map<string, string> }> {
  const results = await Promise.allSettled(
    hosts.map(async (host) => {
      const addresses = await dns.resolve4(host);
      return { host, address: addresses[0] };
    })
  );

  const ips: string[] = [];
  const ipToHost = new Map<string, string>();

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.address) {
      ips.push(result.value.address);
      ipToHost.set(result.value.address, result.value.host);
    } else if (result.status === 'rejected') {
      log('⚠️ DNS lookup failed:', result.reason);
    }
  }

  return { ips, ipToHost };
}

async function fetchGeoForIps(
  ips: string[],
  ipToHost: Map<string, string>
): Promise<void> {
  if (ips.length === 0) return;

  const response = await fetch(IP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ips),
  });

  if (!response.ok) {
    log(`⚠️ ip-api.com returned ${response.status}`);
    return;
  }

  const geoData = (await response.json()) as Array<{
    status: string;
    message?: string;
    query: string;
    lat?: number;
    lon?: number;
    continent?: string;
    country?: string;
    city?: string;
  }>;

  const now = Date.now();
  for (const geo of geoData) {
    const host = ipToHost.get(geo.query);
    if (!host) continue;

    if (geo.status === 'success' && geo.lat != null && geo.lon != null) {
      geoCache.set(host, {
        lat: geo.lat,
        lng: geo.lon,
        region: geo.continent || 'Unknown',
        country: geo.country || 'Unknown',
        city: geo.city || '',
        cachedAt: now,
      });
    } else {
      log(`⚠️ Geo lookup failed for ${geo.query}: ${geo.message ?? 'unknown'}`);
    }
  }
}

async function fetchValidatorApys(): Promise<Map<string, number>> {
  try {
    if (!IOTA_RPC_URL) {
      log('❌ IOTA_RPC_URL is not configured');
      return new Map();
    }
    const res = await fetch(IOTA_RPC_URL, {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'iotax_getValidatorsApy',
        params: [],
      }),
      next: { revalidate: 60 },
    });
    if (!res.ok) return new Map();
    const data = await res.json();
    const apys = data.result?.apys ?? [];
    const map = new Map<string, number>();
    for (const entry of apys) {
      map.set(entry.address, entry.apy);
    }
    return map;
  } catch (err) {
    log('⚠️ Failed to fetch APYs:', err);
    return new Map();
  }
}

export async function GET() {
  try {
    if (!IOTA_RPC_URL) {
      return NextResponse.json(
        { error: 'IOTA_RPC_URL is not configured' },
        { status: 500 }
      );
    }

    log('⏳ 1. Fetching IOTA system state...');

    const [iotaResponse, apyMap] = await Promise.all([
      fetch(IOTA_RPC_URL, {
        method: 'POST',
        headers: rpcHeaders,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'iotax_getLatestIotaSystemStateV2',
          params: [],
        }),
        next: { revalidate: 60 },
      }),
      fetchValidatorApys(),
    ]);

    if (!iotaResponse.ok) {
      throw new Error(`IOTA RPC returned ${iotaResponse.status}`);
    }

    const iotaData = await iotaResponse.json();
    const systemState = iotaData.result?.V2 ?? iotaData.result;

    if (!iotaData.result?.V2 && iotaData.result) {
      log('⚠️ V2 missing from IOTA response — using legacy shape');
    }

    const activeValidators = systemState?.activeValidators ?? [];
    if (activeValidators.length === 0) {
      return NextResponse.json({
        epoch: systemState?.epoch ?? '0',
        totalStake: systemState?.totalStake ?? '0',
        referenceGasPrice: systemState?.referenceGasPrice ?? '0',
        validators: [],
      } satisfies ApiResponse);
    }

    const parsedNodes: ParsedNodeWithHost[] = [];
    const hostsNeedingFetch = new Set<string>();

    for (const val of activeValidators) {
      const host = extractHost(val.netAddress);
      if (!host) continue;

      parsedNodes.push({
        name: val.name,
        description: val.description,
        imageUrl: val.imageUrl,
        projectUrl: val.projectUrl,
        host,
        votingPower: Number(val.votingPower) || 0,
        commissionRate: Number(val.commissionRate) || 0,
        stakingPoolIotaBalance: val.stakingPoolIotaBalance || '0',
        nextEpochStake: val.nextEpochStake || '0',
        gasPrice: val.gasPrice || '0',
        rewardsPool: val.rewardsPool || '0',
        iotaAddress: val.iotaAddress || '',
      });

      const cached = geoCache.get(host);
      if (!cached || !isCacheFresh(cached)) {
        hostsNeedingFetch.add(host);
      }
    }

    const missingHosts = Array.from(hostsNeedingFetch);

    if (missingHosts.length > 0) {
      log(`🌍 2. Resolving ${missingHosts.length} hostnames...`);

      const hostChunks = chunkArray(missingHosts, MAX_HOSTS_PER_BATCH);

      for (const chunk of hostChunks) {
        const { ips, ipToHost } = await resolveHostsToIps(chunk);
        if (ips.length > 0) {
          log(`📡 3. Geolocating chunk of ${ips.length} IPs...`);
          await fetchGeoForIps(ips, ipToHost);
        }
      }
    }

    const finalNodes: ValidatorResponse[] = [];
    for (const node of parsedNodes) {
      const geo = geoCache.get(node.host);
      if (!geo) continue;

      finalNodes.push({
        name: node.name || 'Unknown Node',
        description: node.description || '',
        imageUrl: node.imageUrl || '',
        projectUrl: node.projectUrl || '',
        region: geo.region,
        country: geo.country,
        city: geo.city,
        lat: geo.lat,
        lng: geo.lng,
        votingPower: node.votingPower,
        commissionRate: node.commissionRate,
        stakingPoolIotaBalance: node.stakingPoolIotaBalance,
        nextEpochStake: node.nextEpochStake,
        gasPrice: node.gasPrice,
        rewardsPool: node.rewardsPool,
        iotaAddress: node.iotaAddress,
        apy: apyMap.get(node.iotaAddress) ?? null,
      });
    }

    log(`🚀 4. Returning ${finalNodes.length} validators.`);
    return NextResponse.json({
      epoch: systemState?.epoch ?? '0',
      totalStake: systemState?.totalStake ?? '0',
      referenceGasPrice: systemState?.referenceGasPrice ?? '0',
      validators: finalNodes,
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Validator API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch validator data' },
      { status: 500 }
    );
  }
}
