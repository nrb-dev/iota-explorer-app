import 'server-only';

import type { IotaNetwork } from '@/lib/iota-network';
import { extractHost, getGeoForHosts } from '@/lib/iota/geo';
import { fetchSystemState, rpcCall } from '@/lib/iota/rpc-client';
import type { Validator, ValidatorsData } from '@/lib/iota/types';

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

type DataCacheEntry = { data: ValidatorsData; expiresAt: number };
const dataCache = new Map<IotaNetwork, DataCacheEntry>();
const inflight = new Map<IotaNetwork, Promise<ValidatorsData>>();
const DATA_CACHE_TTL_MS = 60_000;

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

/**
 * Returns the full validator set with epoch + supply context, applying
 * a short in-process cache so multiple consumers within one invocation
 * share the same RPC roundtrip.
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

    type Parsed = {
      raw: RawValidator;
      host: string | null;
    };

    const activeValidators = (systemState.activeValidators ?? []) as RawValidator[];
    const parsed: Parsed[] = activeValidators.map((v) => ({
      raw: v,
      host: extractHost(v.netAddress),
    }));
    const geoByHost = await getGeoForHosts(
      parsed.flatMap((p) => (p.host ? [p.host] : []))
    );

    const validators: Validator[] = parsed.map(({ raw, host }) => {
      const geo = host ? geoByHost.get(host) : undefined;
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
