export type Validator = {
  name: string;
  description: string;
  imageUrl: string;
  projectUrl: string;
  region: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
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
  validators: Validator[];
  countries: string[];
};

export type CountryGroup = {
  country: string;
  lat: number;
  lng: number;
  validators: Validator[];
};
