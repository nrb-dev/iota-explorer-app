import type { GeoValidator, RegionGroup, CountryGroup } from './types';

/* ── Spherical centroid ── */
export function computeCentroid(points: Array<{ lat: number; lng: number }>): {
  lat: number;
  lng: number;
} {
  let x = 0;
  let y = 0;
  let z = 0;

  for (const p of points) {
    const latRad = (p.lat * Math.PI) / 180;
    const lngRad = (p.lng * Math.PI) / 180;
    x += Math.cos(latRad) * Math.cos(lngRad);
    y += Math.cos(latRad) * Math.sin(lngRad);
    z += Math.sin(latRad);
  }

  const n = points.length;
  x /= n;
  y /= n;
  z /= n;

  const lng = Math.atan2(y, x);
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

/* ── Generic groupBy ── */
function groupBy<K extends string>(
  validators: GeoValidator[],
  keyFn: (v: GeoValidator) => K
): Map<K, GeoValidator[]> {
  const map = new Map<K, GeoValidator[]>();
  for (const v of validators) {
    const key = keyFn(v);
    const list = map.get(key) ?? [];
    list.push(v);
    map.set(key, list);
  }
  return map;
}

export function groupByRegion(validators: GeoValidator[]): RegionGroup[] {
  const grouped = groupBy(validators, (v) => v.region);
  return Array.from(grouped.entries()).map(([region, list]) => {
    const { lat, lng } = computeCentroid(list);
    const countries = Array.from(new Set(list.map((v) => v.country))).sort();
    return { region, lat, lng, validators: list, countries };
  });
}

export function groupByCountry(validators: GeoValidator[]): CountryGroup[] {
  const grouped = groupBy(validators, (v) => v.country);
  return Array.from(grouped.entries()).map(([country, list]) => {
    const { lat, lng } = computeCentroid(list);
    return { country, lat, lng, validators: list };
  });
}
