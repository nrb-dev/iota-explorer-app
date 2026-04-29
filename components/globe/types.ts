import type { IotaNetwork } from '@/lib/iota-network';
import type {
  Validator,
  ValidatorsData,
} from '@/lib/iota/types';

export type { IotaNetwork };
export type { Validator };

/** Validator narrowed to the one usable by the 3D globe (geo present). */
export type GeoValidator = Validator & { lat: number; lng: number };

export type ValidatorApiResponse = ValidatorsData;

export type LabelDatum = {
  id: string;
  lat: number;
  lng: number;
  element: HTMLElement;
};

export type ArcDatum = {
  id: string;
  label: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  altitude: number;
  stroke: number;
  dashLength: number;
  dashGap: number;
  dashInitialGap: number;
  dashAnimateTime: number;
  color: (t: number) => string;
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
