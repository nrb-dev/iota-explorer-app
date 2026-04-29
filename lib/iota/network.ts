import 'server-only';

import type { IotaNetwork } from '@/lib/iota-network';
import {
  fetchSystemState,
  IOTA_COIN_TYPE,
  rpcCall,
} from '@/lib/iota/rpc-client';
import { getValidatorsData } from '@/lib/iota/validators';
import type {
  AddressMetrics,
  AddressMetricsPoint,
  EpochData,
  EpochSummary,
  NetworkData,
  NetworkMetrics,
  RecentCheckpoint,
} from '@/lib/iota/types';

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

async function fetchTotalSupply(network: IotaNetwork): Promise<unknown | null> {
  const withCoinType = await rpcCall<unknown>(
    network,
    'iotax_getTotalSupply',
    [IOTA_COIN_TYPE],
    300
  );
  if (withCoinType != null) return withCoinType;

  return rpcCall<unknown>(network, 'iotax_getTotalSupply', [], 300);
}

function extractSupplyValue(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw);
  if (typeof raw === 'object') {
    const v = (raw as RawSupply).value;
    return v != null ? String(v) : null;
  }
  return null;
}

async function fetchRecentCheckpoints(
  network: IotaNetwork
): Promise<RecentCheckpoint[]> {
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

export async function getNetworkData(
  network: IotaNetwork = 'mainnet'
): Promise<NetworkData> {
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
    fetchRecentCheckpoints(network),
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
