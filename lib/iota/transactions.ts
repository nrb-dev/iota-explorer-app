import 'server-only';

import type { IotaNetwork } from '@/lib/iota-network';
import { rpcCall } from '@/lib/iota/rpc-client';
import type {
  TransactionDetail,
  TransactionSummary,
} from '@/lib/iota/types';

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
      gasUsed: totalGas(tx.effects?.gasUsed),
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
