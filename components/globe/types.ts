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
  /** null when DNS or geo lookup fails — these validators are still in the table but skipped on the globe. */
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

/** Validator narrowed to the one usable by the 3D globe (geo present). */
export type GeoValidator = Validator & { lat: number; lng: number };

export type ValidatorApiResponse = {
  network: IotaNetwork;
  epoch: string;
  totalStake: string;
  referenceGasPrice: string;
  validators: Validator[];
};

export type LabelDatum = {
  id: string;
  lat: number;
  lng: number;
  element: HTMLElement;
};

export type ZoomBand = 'far' | 'close';

export type RegionGroup = {
  region: string;
  lat: number;
  lng: number;
  validators: GeoValidator[];
  countries: string[];
};

export type CountryGroup = {
  country: string;
  lat: number;
  lng: number;
  validators: GeoValidator[];
};

export function hasGeo(v: Validator): v is GeoValidator {
  return v.lat != null && v.lng != null;
}
