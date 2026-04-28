/**
 * Server-only IOTA RPC client + geo enrichment.
 *
 * Both the public `/api/validators` route and server-rendered pages
 * (e.g. `/validators/[address]`) consume `getValidatorsData()` from here so
 * RPC quota, parsing, and geo cache stay in one place.
 *
 * Validator-set data on IOTA Rebased is fixed within an epoch (~24h), so
 * aggressive caching is safe. Mid-epoch fields (APY estimate, gasPrice)
 * still refresh whenever the cache TTL expires.
 */
import 'server-only';
import dns from 'dns/promises';

import { parseIotaNetwork, type IotaNetwork } from '@/lib/iota-network';

/* ── Types ── */

export { parseIotaNetwork, type IotaNetwork };

export type Validator = {
  name: string;
  description: string;
  imageUrl: string;
  projectUrl: string;
  region: string;
  country: string;
  city: string;
  /** May be null when DNS / geo lookup fails — table still shows them, globe filters out. */
  lat: number | null;
  lng: number | null;
  votingPower: number;
  commissionRate: number;
  stakingPoolIotaBalance: string;
  nextEpochStake: string;
  gasPrice: string;
  rewardsPool: string;
  nextEpochGasPrice: string;
  nextEpochCommissionRate: number | null;
  stakingPoolId: string | null;
  stakingPoolActivationEpoch: string | null;
  poolTokenBalance: string;
  pendingStake: string;
  pendingTotalIotaWithdraw: string;
  pendingPoolTokenWithdraw: string;
  operationCapId: string | null;
  protocolPubkey: string | null;
  networkPubkey: string | null;
  workerPubkey: string | null;
  proofOfPossession: string | null;
  iotaAddress: string;
  netAddress: string | null;
  p2pAddress: string | null;
  primaryAddress: string | null;
  workerAddress: string | null;
  apy: number | null;
};

export type ValidatorsData = {
  network: IotaNetwork;
  epoch: string;
  totalStake: string;
  referenceGasPrice: string;
  validators: Validator[];
};

export type EpochData = {
  network: IotaNetwork;
  epoch: string;
  epochStartTimestampMs: string | null;
  epochDurationMs: string | null;
};

export type NetworkData = {
  network: IotaNetwork;
  metrics: unknown | null;
  circulatingSupply: unknown | null;
  totalSupply: unknown | null;
  referenceGasPrice: string;
  latestCheckpoint: string | null;
};

type GeoEntry = {
  lat: number;
  lng: number;
  region: string;
  country: string;
  city: string;
  cachedAt: number;
};

type RawValidator = {
  name?: string;
  description?: string;
  imageUrl?: string;
  projectUrl?: string;
  netAddress?: string;
  votingPower?: string | number;
  commissionRate?: string | number;
  stakingPoolIotaBalance?: string;
  nextEpochStake?: string;
  gasPrice?: string;
  rewardsPool?: string;
  nextEpochGasPrice?: string;
  nextEpochCommissionRate?: string | number;
  stakingPoolId?: string;
  stakingPoolActivationEpoch?: string;
  poolTokenBalance?: string;
  pendingStake?: string;
  pendingTotalIotaWithdraw?: string;
  pendingPoolTokenWithdraw?: string;
  operationCapId?: string;
  protocolPubkey?: string;
  networkPubkey?: string;
  workerPubkey?: string;
  proofOfPossession?: string;
  iotaAddress?: string;
  p2pAddress?: string;
  primaryAddress?: string;
  workerAddress?: string;
};

/* ── Config ── */

const GEO_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_HOSTS_PER_BATCH = 100;
const RPC_TIMEOUT_MS = 10_000;

const DEFAULT_RPC_URLS = {
  mainnet: 'https://api.mainnet.iota.cafe',
  testnet: 'https://api.testnet.iota.cafe',
} satisfies Record<IotaNetwork, string>;

const IP_API_URL = process.env.IP_API_URL;
const ALLOW_INSECURE_GEO_HTTP =
  process.env.IP_API_ALLOW_INSECURE_HTTP === 'true';

const NETADDRESS_REGEX = /\/(ip4|dns|dns4)\/([^/]+)\//;

const isDev = process.env.NODE_ENV !== 'production';
const log = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};

/* ── Module-level caches ── */

const geoCache = new Map<string, GeoEntry>();

/**
 * In-process memoization of the full `getValidatorsData()` response.
 * Avoids hammering RPC when multiple consumers (route + detail page) request
 * within the same edge invocation. TTL kept short — Next's fetch cache layer
 * handles cross-invocation deduplication via `next: { revalidate }`.
 */
type DataCacheEntry = { data: ValidatorsData; expiresAt: number };
const dataCache = new Map<IotaNetwork, DataCacheEntry>();
const inflight = new Map<IotaNetwork, Promise<ValidatorsData>>();
const DATA_CACHE_TTL_MS = 60_000;

/* ── Helpers ── */

function isCacheFresh(entry: GeoEntry): boolean {
  return Date.now() - entry.cachedAt < GEO_TTL_MS;
}

function extractHost(netAddress: string | undefined): string | null {
  if (!netAddress) return null;
  const match = netAddress.match(NETADDRESS_REGEX);
  return match ? match[2] : null;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function getRpcUrl(network: IotaNetwork): string {
  if (network === 'testnet') {
    return (
      process.env.IOTA_TESTNET_RPC_URL ||
      process.env.NEXT_PUBLIC_IOTA_TESTNET_RPC_URL ||
      DEFAULT_RPC_URLS.testnet
    );
  }

  return (
    process.env.IOTA_MAINNET_RPC_URL ||
    process.env.NEXT_PUBLIC_IOTA_MAINNET_RPC_URL ||
    process.env.IOTA_RPC_URL ||
    DEFAULT_RPC_URLS.mainnet
  );
}

function getRpcKey(network: IotaNetwork): string {
  if (network === 'testnet') {
    return process.env.IOTA_TESTNET_RPC_KEY || process.env.IOTA_RPC_KEY || '';
  }

  return process.env.IOTA_MAINNET_RPC_KEY || process.env.IOTA_RPC_KEY || '';
}

async function rpcCall<T>(
  network: IotaNetwork,
  method: string,
  params: unknown[],
  revalidate = 60
): Promise<T | null> {
  const rpcUrl = getRpcUrl(network);
  const rpcKey = getRpcKey(network);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(rpcKey && { Authorization: `Bearer ${rpcKey}` }),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      next: { revalidate },
      signal: controller.signal,
    });

    if (!res.ok) {
      log(`⚠️ RPC ${network}:${method} returned ${res.status}`);
      return null;
    }

    const json = await res.json();
    if (json.error) {
      log(`⚠️ RPC ${network}:${method} error:`, json.error);
      return null;
    }

    return json.result as T;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      log(`⚠️ RPC ${network}:${method} timed out after ${RPC_TIMEOUT_MS}ms`);
    } else {
      log(`⚠️ RPC ${network}:${method} failed:`, err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/* ── RPC fetchers ── */

async function fetchValidatorApys(
  network: IotaNetwork
): Promise<Map<string, number>> {
  type ApyResult = { apys?: Array<{ address: string; apy: number }> };
  const result = await rpcCall<ApyResult>(
    network,
    'iotax_getValidatorsApy',
    []
  );
  const map = new Map<string, number>();
  if (!result?.apys) return map;
  for (const entry of result.apys) {
    map.set(entry.address, entry.apy);
  }
  return map;
}

type SystemStateResult = {
  V2?: SystemStateShape;
} & SystemStateShape;

type SystemStateShape = {
  epoch?: string;
  totalStake?: string;
  referenceGasPrice?: string;
  activeValidators?: RawValidator[];
};

async function fetchSystemState(
  network: IotaNetwork
): Promise<SystemStateShape | null> {
  const result = await rpcCall<SystemStateResult>(
    network,
    'iotax_getLatestIotaSystemStateV2',
    []
  );
  if (!result) return null;
  // V2 wrapper varies between RPC providers.
  return result.V2 ?? result;
}

/* ── Geo enrichment ── */

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
    }
  }

  return { ips, ipToHost };
}

async function fetchGeoForIps(
  ips: string[],
  ipToHost: Map<string, string>
): Promise<void> {
  if (ips.length === 0) return;
  if (!IP_API_URL) {
    log('⚠️ IP_API_URL is not configured; geo enrichment skipped');
    return;
  }
  const isHttpsGeoProvider = IP_API_URL.startsWith('https://');
  const isExplicitHttpGeoProvider =
    IP_API_URL.startsWith('http://') && ALLOW_INSECURE_GEO_HTTP;
  if (!isHttpsGeoProvider && !isExplicitHttpGeoProvider) {
    log(
      '⚠️ IP_API_URL must use HTTPS unless IP_API_ALLOW_INSECURE_HTTP=true; geo enrichment skipped'
    );
    return;
  }

  try {
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
      }
    }
  } catch (err) {
    log('⚠️ Geo batch fetch failed:', err);
  }
}

/* ── Public API ── */

/**
 * Returns the full validator set with epoch + supply context, applying
 * a short in-process cache so multiple consumers within one invocation
 * share the same RPC roundtrip.
 *
 * Validators that resolve cleanly are returned with full geo. Validators
 * whose hostname can't be resolved or geolocated are still included
 * (with `lat`/`lng` null and `country: 'Unknown'`) so the UI can show
 * them in the table; the globe layer filters them out.
 */
export async function getValidatorsData(
  network: IotaNetwork = 'mainnet'
): Promise<ValidatorsData> {
  const now = Date.now();
  const cached = dataCache.get(network);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  const pending = inflight.get(network);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    const [systemState, apyMap] = await Promise.all([
      fetchSystemState(network),
      fetchValidatorApys(network),
    ]);

    if (!systemState) {
      throw new Error('Failed to fetch IOTA system state');
    }

    const activeValidators = systemState.activeValidators ?? [];

    type Parsed = {
      raw: RawValidator;
      host: string | null;
    };

    const parsed: Parsed[] = activeValidators.map((v) => ({
      raw: v,
      host: extractHost(v.netAddress),
    }));

    // Refresh geo for hosts that aren't in cache or are stale.
    const hostsNeedingFetch = new Set<string>();
    for (const p of parsed) {
      if (!p.host) continue;
      const cached = geoCache.get(p.host);
      if (!cached || !isCacheFresh(cached)) {
        hostsNeedingFetch.add(p.host);
      }
    }

    if (hostsNeedingFetch.size > 0) {
      const hostChunks = chunkArray(
        Array.from(hostsNeedingFetch),
        MAX_HOSTS_PER_BATCH
      );
      for (const chunk of hostChunks) {
        const { ips, ipToHost } = await resolveHostsToIps(chunk);
        if (ips.length > 0) {
          await fetchGeoForIps(ips, ipToHost);
        }
      }
    }

    const validators: Validator[] = parsed.map(({ raw, host }) => {
      const geo = host ? geoCache.get(host) : undefined;
      return {
        name: raw.name || 'Unknown Validator',
        description: raw.description || '',
        imageUrl: raw.imageUrl || '',
        projectUrl: raw.projectUrl || '',
        region: geo?.region ?? 'Unknown',
        country: geo?.country ?? 'Unknown',
        city: geo?.city ?? '',
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        votingPower: Number(raw.votingPower) || 0,
        commissionRate: Number(raw.commissionRate) || 0,
        stakingPoolIotaBalance: raw.stakingPoolIotaBalance || '0',
        nextEpochStake: raw.nextEpochStake || '0',
        gasPrice: raw.gasPrice || '0',
        rewardsPool: raw.rewardsPool || '0',
        nextEpochGasPrice: raw.nextEpochGasPrice || '0',
        nextEpochCommissionRate:
          raw.nextEpochCommissionRate != null
            ? Number(raw.nextEpochCommissionRate)
            : null,
        stakingPoolId: raw.stakingPoolId ?? null,
        stakingPoolActivationEpoch: raw.stakingPoolActivationEpoch ?? null,
        poolTokenBalance: raw.poolTokenBalance || '0',
        pendingStake: raw.pendingStake || '0',
        pendingTotalIotaWithdraw: raw.pendingTotalIotaWithdraw || '0',
        pendingPoolTokenWithdraw: raw.pendingPoolTokenWithdraw || '0',
        operationCapId: raw.operationCapId ?? null,
        protocolPubkey: raw.protocolPubkey ?? null,
        networkPubkey: raw.networkPubkey ?? null,
        workerPubkey: raw.workerPubkey ?? null,
        proofOfPossession: raw.proofOfPossession ?? null,
        iotaAddress: raw.iotaAddress || '',
        netAddress: raw.netAddress ?? null,
        p2pAddress: raw.p2pAddress ?? null,
        primaryAddress: raw.primaryAddress ?? null,
        workerAddress: raw.workerAddress ?? null,
        apy: raw.iotaAddress ? (apyMap.get(raw.iotaAddress) ?? null) : null,
      };
    });

    const data: ValidatorsData = {
      network,
      epoch: systemState.epoch ?? '0',
      totalStake: systemState.totalStake ?? '0',
      referenceGasPrice: systemState.referenceGasPrice ?? '0',
      validators,
    };

    dataCache.set(network, {
      data,
      expiresAt: Date.now() + DATA_CACHE_TTL_MS,
    });
    return data;
  })();
  inflight.set(network, request);

  try {
    return await request;
  } finally {
    inflight.delete(network);
  }
}

/**
 * Find one validator by IOTA address, case-insensitive.
 * Returns null when not found — callers should `notFound()`.
 */
export async function getValidatorByAddress(
  address: string,
  network: IotaNetwork = 'mainnet'
): Promise<Validator | null> {
  const data = await getValidatorsData(network);
  const target = address.toLowerCase();
  return (
    data.validators.find((v) => v.iotaAddress.toLowerCase() === target) ?? null
  );
}

export async function getEpochData(
  network: IotaNetwork = 'mainnet'
): Promise<EpochData> {
  const currentEpoch = await rpcCall<Record<string, unknown> | string | number>(
    network,
    'iotax_getCurrentEpoch',
    [],
    300
  );

  if (currentEpoch && typeof currentEpoch === 'object') {
    return {
      network,
      epoch: String(
        currentEpoch.epoch ??
          currentEpoch.epochId ??
          currentEpoch.currentEpoch ??
          '0'
      ),
      epochStartTimestampMs:
        currentEpoch.epochStartTimestampMs != null
          ? String(currentEpoch.epochStartTimestampMs)
          : null,
      epochDurationMs:
        currentEpoch.epochDurationMs != null
          ? String(currentEpoch.epochDurationMs)
          : null,
    };
  }

  if (currentEpoch != null) {
    return {
      network,
      epoch: String(currentEpoch),
      epochStartTimestampMs: null,
      epochDurationMs: null,
    };
  }

  const validators = await getValidatorsData(network);
  return {
    network,
    epoch: validators.epoch,
    epochStartTimestampMs: null,
    epochDurationMs: null,
  };
}

export async function getNetworkData(
  network: IotaNetwork = 'mainnet'
): Promise<NetworkData> {
  const [
    metrics,
    circulatingSupply,
    totalSupply,
    referenceGasPrice,
    latestCheckpoint,
  ] = await Promise.all([
    rpcCall<unknown>(network, 'iotax_getNetworkMetrics', [], 60),
    rpcCall<unknown>(network, 'iotax_getCirculatingSupply', [], 300),
    rpcCall<unknown>(network, 'iotax_getTotalSupply', [], 300),
    rpcCall<string | number>(network, 'iotax_getReferenceGasPrice', [], 60),
    rpcCall<string | number>(
      network,
      'iota_getLatestCheckpointSequenceNumber',
      [],
      60
    ),
  ]);

  return {
    network,
    metrics,
    circulatingSupply,
    totalSupply,
    referenceGasPrice:
      referenceGasPrice != null ? String(referenceGasPrice) : '0',
    latestCheckpoint:
      latestCheckpoint != null ? String(latestCheckpoint) : null,
  };
}

export async function getRpcLatency(
  network: IotaNetwork = 'mainnet'
): Promise<{ network: IotaNetwork; latencyMs: number }> {
  const startedAt = Date.now();
  await rpcCall<string>(network, 'iota_getChainIdentifier', [], 0);
  return {
    network,
    latencyMs: Date.now() - startedAt,
  };
}
