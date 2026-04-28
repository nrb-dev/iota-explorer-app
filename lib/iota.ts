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

export type NetworkMetrics = {
  currentTps: number | null;
  tps30Days: number | null;
  totalPackages: string | null;
  totalAddresses: string | null;
  totalObjects: string | null;
  currentEpoch: string | null;
  currentCheckpoint: string | null;
};

export type AddressMetrics = {
  cumulativeAddresses: number;
  cumulativeActiveAddresses: number;
  dailyActiveAddresses: number;
};

export type AddressMetricsPoint = AddressMetrics & {
  epoch: number;
  timestampMs: number;
  checkpoint: number;
};

export type RecentCheckpoint = {
  sequenceNumber: string;
  digest: string | null;
  timestampMs: string;
  networkTotalTransactions: string;
  transactionCount: number;
};

export type NetworkData = {
  network: IotaNetwork;
  metrics: NetworkMetrics;
  circulatingSupply: string | null;
  totalSupply: string | null;
  referenceGasPrice: string;
  latestCheckpoint: string | null;
  recentCheckpoints: RecentCheckpoint[];
  addressMetrics: AddressMetrics | null;
  addressSeries: AddressMetricsPoint[];
  epochStartTimestampMs: string | null;
  epochDurationMs: string | null;
};

export type EpochSummary = {
  epoch: string;
  firstCheckpointId: string;
  lastCheckpointId: string | null;
  epochStartTimestampMs: string;
  epochEndTimestampMs: string | null;
  epochTotalTransactions: string;
  totalGasFees: string | null;
  totalStakeRewardsDistributed: string | null;
  storageCharge: string | null;
  storageRebate: string | null;
  referenceGasPrice: string | null;
};

export type TransactionSummary = {
  digest: string;
  sender: string | null;
  timestampMs: string | null;
  checkpoint: string | null;
  txCount: number | null;
  gasUsed: string | null;
  status: string | null;
  kind: string | null;
};

export type ObjectChangeSummary = {
  type: string;
  objectId: string;
  objectType: string | null;
  owner: string | null;
  version: string | null;
  previousVersion: string | null;
  digest: string | null;
};

export type BalanceChangeSummary = {
  owner: string;
  coinType: string;
  amount: string;
};

export type TransactionDetail = {
  digest: string;
  status: string | null;
  kind: string | null;
  sender: string | null;
  checkpoint: string | null;
  epoch: string | null;
  timestampMs: string | null;
  gasUsed: string | null;
  gasPrice: string | null;
  gasBudget: string | null;
  objectChanges: ObjectChangeSummary[];
  balanceChanges: BalanceChangeSummary[];
  eventsCount: number;
};

type CheckpointSummary = {
  sequenceNumber?: string;
  digest?: string;
  timestampMs?: string;
  networkTotalTransactions?: string;
  transactions?: string[];
};

type CheckpointPage = {
  data?: CheckpointSummary[];
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
const IOTA_COIN_TYPE = '0x2::iota::IOTA';

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
  epochStartTimestampMs?: string;
  epochDurationMs?: string;
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

async function fetchTotalSupply(network: IotaNetwork): Promise<unknown | null> {
  // Most providers require a coin type parameter for this method.
  const withCoinType = await rpcCall<unknown>(
    network,
    'iotax_getTotalSupply',
    [IOTA_COIN_TYPE],
    300
  );
  if (withCoinType != null) return withCoinType;

  // Compatibility fallback for providers that still accept no params.
  return rpcCall<unknown>(network, 'iotax_getTotalSupply', [], 300);
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
  const systemState = await fetchSystemState(network);
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
      epochStartTimestampMs: systemState?.epochStartTimestampMs ?? null,
      epochDurationMs: systemState?.epochDurationMs ?? null,
    };
  }

  if (systemState) {
    return {
      network,
      epoch: systemState.epoch ?? '0',
      epochStartTimestampMs: systemState.epochStartTimestampMs ?? null,
      epochDurationMs: systemState.epochDurationMs ?? null,
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

type RawNetworkMetrics = {
  currentTps?: number | string;
  tps30Days?: number | string;
  totalPackages?: string;
  totalAddresses?: string;
  totalObjects?: string;
  currentEpoch?: string;
  currentCheckpoint?: string;
};

type RawSupply = { value?: string | number };

function extractSupplyValue(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw);
  if (typeof raw === 'object') {
    const v = (raw as RawSupply).value;
    return v != null ? String(v) : null;
  }
  return null;
}

export async function getNetworkData(
  network: IotaNetwork = 'mainnet'
): Promise<NetworkData> {
  const fetchCheckpoints = async (): Promise<RecentCheckpoint[]> => {
    const checkpointsPage = await rpcCall<CheckpointPage>(
      network,
      'iota_getCheckpoints',
      [null, 30, true],
      60
    );
    return (checkpointsPage?.data ?? [])
      .filter(
        (row) =>
          row.sequenceNumber != null &&
          row.timestampMs != null &&
          row.networkTotalTransactions != null
      )
      .map((row) => ({
        sequenceNumber: row.sequenceNumber!,
        digest: row.digest ?? null,
        timestampMs: row.timestampMs!,
        networkTotalTransactions: row.networkTotalTransactions!,
        transactionCount: Array.isArray(row.transactions)
          ? row.transactions.length
          : 0,
      }));
  };

  const [
    rawMetrics,
    recentCheckpoints,
    circulatingSupplyRaw,
    totalSupplyRaw,
    referenceGasPrice,
    latestCheckpoint,
    addressSeriesRaw,
    systemState,
  ] = await Promise.all([
    rpcCall<RawNetworkMetrics>(network, 'iotax_getNetworkMetrics', [], 60),
    fetchCheckpoints(),
    rpcCall<unknown>(network, 'iotax_getCirculatingSupply', [], 300),
    fetchTotalSupply(network),
    rpcCall<string | number>(network, 'iotax_getReferenceGasPrice', [], 60),
    rpcCall<string | number>(
      network,
      'iota_getLatestCheckpointSequenceNumber',
      [],
      60
    ),
    rpcCall<AddressMetricsPoint[]>(
      network,
      'iotax_getAllEpochAddressMetrics',
      [],
      300
    ),
    fetchSystemState(network),
  ]);

  const metrics: NetworkMetrics = {
    currentTps:
      rawMetrics?.currentTps != null ? Number(rawMetrics.currentTps) : null,
    tps30Days:
      rawMetrics?.tps30Days != null ? Number(rawMetrics.tps30Days) : null,
    totalPackages: rawMetrics?.totalPackages ?? null,
    totalAddresses: rawMetrics?.totalAddresses ?? null,
    totalObjects: rawMetrics?.totalObjects ?? null,
    currentEpoch: rawMetrics?.currentEpoch ?? null,
    currentCheckpoint: rawMetrics?.currentCheckpoint ?? null,
  };

  const addressSeries = (addressSeriesRaw ?? []).slice(-30);
  const last = addressSeries[addressSeries.length - 1] ?? null;
  const addressMetrics: AddressMetrics | null = last
    ? {
        cumulativeAddresses: last.cumulativeAddresses,
        cumulativeActiveAddresses: last.cumulativeActiveAddresses,
        dailyActiveAddresses: last.dailyActiveAddresses,
      }
    : null;

  return {
    network,
    metrics,
    circulatingSupply: extractSupplyValue(circulatingSupplyRaw),
    totalSupply: extractSupplyValue(totalSupplyRaw),
    referenceGasPrice:
      referenceGasPrice != null ? String(referenceGasPrice) : '0',
    latestCheckpoint:
      latestCheckpoint != null
        ? String(latestCheckpoint)
        : (metrics.currentCheckpoint ?? null),
    recentCheckpoints,
    addressMetrics,
    addressSeries,
    epochStartTimestampMs: systemState?.epochStartTimestampMs ?? null,
    epochDurationMs: systemState?.epochDurationMs ?? null,
  };
}

type RawEpoch = {
  epoch: string;
  firstCheckpointId: string;
  epochStartTimestamp: string;
  epochTotalTransactions: string;
  referenceGasPrice?: string;
  endOfEpochInfo: null | {
    lastCheckpointId: string;
    epochEndTimestamp: string;
    totalGasFees: string;
    totalStakeRewardsDistributed: string;
    storageCharge: string;
    storageRebate: string;
  };
};

export async function getEpochs(
  network: IotaNetwork = 'mainnet',
  limit = 30
): Promise<EpochSummary[]> {
  const result = await rpcCall<{ data: RawEpoch[] }>(
    network,
    'iotax_getEpochs',
    [null, limit, true],
    300
  );
  if (!result?.data) return [];
  return result.data.map((row) => ({
    epoch: row.epoch,
    firstCheckpointId: row.firstCheckpointId,
    lastCheckpointId: row.endOfEpochInfo?.lastCheckpointId ?? null,
    epochStartTimestampMs: row.epochStartTimestamp,
    epochEndTimestampMs: row.endOfEpochInfo?.epochEndTimestamp ?? null,
    epochTotalTransactions: row.epochTotalTransactions,
    totalGasFees: row.endOfEpochInfo?.totalGasFees ?? null,
    totalStakeRewardsDistributed:
      row.endOfEpochInfo?.totalStakeRewardsDistributed ?? null,
    storageCharge: row.endOfEpochInfo?.storageCharge ?? null,
    storageRebate: row.endOfEpochInfo?.storageRebate ?? null,
    referenceGasPrice: row.referenceGasPrice ?? null,
  }));
}

type RawObjectChange = {
  type?: string;
  objectId?: string;
  objectType?: string;
  owner?:
    | string
    | { AddressOwner?: string; ObjectOwner?: string; Shared?: unknown };
  version?: string;
  previousVersion?: string;
  digest?: string;
};

type RawBalanceChange = {
  owner?:
    | string
    | { AddressOwner?: string; ObjectOwner?: string; Shared?: unknown };
  coinType?: string;
  amount?: string;
};

type RawTransaction = {
  digest: string;
  timestampMs?: string;
  checkpoint?: string;
  transaction?: {
    data?: {
      sender?: string;
      gasData?: {
        price?: string;
        budget?: string;
      };
      transaction?: {
        kind?: string;
        epoch?: string;
        transactions?: unknown[];
      };
    };
  };
  effects?: {
    status?: { status?: string; error?: string };
    executedEpoch?: string;
    gasUsed?: {
      computationCost?: string;
      storageCost?: string;
      storageRebate?: string;
      nonRefundableStorageFee?: string;
    };
    transactionDigest?: string;
  };
  objectChanges?: RawObjectChange[];
  balanceChanges?: RawBalanceChange[];
  events?: unknown[];
};

function ownerLabel(
  owner: RawObjectChange['owner'] | RawBalanceChange['owner']
): string | null {
  if (owner == null) return null;
  if (typeof owner === 'string') return owner;
  if (owner.AddressOwner) return owner.AddressOwner;
  if (owner.ObjectOwner) return owner.ObjectOwner;
  if (owner.Shared !== undefined) return 'Shared';
  return null;
}

function totalGas(
  gas?:
    | {
        computationCost?: string;
        storageCost?: string;
        storageRebate?: string;
      }
    | undefined
): string | null {
  if (!gas || typeof gas !== 'object') return null;
  try {
    return (
      BigInt(gas.computationCost ?? '0') +
      BigInt(gas.storageCost ?? '0') -
      BigInt(gas.storageRebate ?? '0')
    ).toString();
  } catch {
    return null;
  }
}

export async function getRecentTransactions(
  network: IotaNetwork = 'mainnet',
  limit = 25
): Promise<TransactionSummary[]> {
  const result = await rpcCall<{ data: RawTransaction[] }>(
    network,
    'iotax_queryTransactionBlocks',
    [{ options: { showInput: true, showEffects: true } }, null, limit, true],
    0
  );
  if (!result?.data) return [];
  return result.data.map((tx) => {
    const gas = tx.effects?.gasUsed;
    const totalGas =
      gas != null
        ? (
            BigInt(gas.computationCost ?? '0') +
            BigInt(gas.storageCost ?? '0') -
            BigInt(gas.storageRebate ?? '0')
          ).toString()
        : null;
    const inner = tx.transaction?.data?.transaction;
    const txCount =
      inner?.kind === 'ProgrammableTransaction' &&
      Array.isArray(inner.transactions)
        ? inner.transactions.length
        : null;
    return {
      digest: tx.digest,
      sender: tx.transaction?.data?.sender ?? null,
      timestampMs: tx.timestampMs ?? null,
      checkpoint: tx.checkpoint ?? null,
      txCount,
      gasUsed: totalGas,
      status: tx.effects?.status?.status ?? null,
      kind: inner?.kind ?? null,
    };
  });
}

export async function getTransactionDetail(
  network: IotaNetwork,
  digest: string
): Promise<TransactionDetail | null> {
  const tx = await rpcCall<RawTransaction | null>(
    network,
    'iota_getTransactionBlock',
    [
      digest,
      {
        showInput: true,
        showEffects: true,
        showObjectChanges: true,
        showBalanceChanges: true,
        showEvents: true,
      },
    ],
    0
  );

  if (!tx) return null;

  const inner = tx.transaction?.data?.transaction;
  const status = tx.effects?.status?.status ?? null;
  const objectChanges = (tx.objectChanges ?? []).map((change) => ({
    type: change.type ?? 'unknown',
    objectId: change.objectId ?? '—',
    objectType: change.objectType ?? null,
    owner: ownerLabel(change.owner),
    version: change.version ?? null,
    previousVersion: change.previousVersion ?? null,
    digest: change.digest ?? null,
  }));
  const balanceChanges = (tx.balanceChanges ?? []).map((change) => ({
    owner: ownerLabel(change.owner) ?? '—',
    coinType: change.coinType ?? '—',
    amount: change.amount ?? '0',
  }));

  return {
    digest: tx.digest,
    status,
    kind: inner?.kind ?? null,
    sender: tx.transaction?.data?.sender ?? null,
    checkpoint: tx.checkpoint ?? null,
    epoch: inner?.epoch ?? tx.effects?.executedEpoch ?? null,
    timestampMs: tx.timestampMs ?? null,
    gasUsed: totalGas(tx.effects?.gasUsed),
    gasPrice: tx.transaction?.data?.gasData?.price ?? null,
    gasBudget: tx.transaction?.data?.gasData?.budget ?? null,
    objectChanges,
    balanceChanges,
    eventsCount: Array.isArray(tx.events) ? tx.events.length : 0,
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
