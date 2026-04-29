import type { IotaNetwork } from '@/lib/iota-network';

export type { IotaNetwork };

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
