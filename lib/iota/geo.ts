import 'server-only';

import dns from 'dns/promises';

import { extractHost } from '@/lib/iota/net-address';
import { log } from '@/lib/iota/rpc-client';

const GEO_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_HOSTS_PER_BATCH = 100;
const IP_API_URL = process.env.IP_API_URL;
const ALLOW_INSECURE_GEO_HTTP =
  process.env.IP_API_ALLOW_INSECURE_HTTP === 'true';

export type GeoEntry = {
  lat: number;
  lng: number;
  region: string;
  country: string;
  city: string;
  cachedAt: number;
};

const geoCache = new Map<string, GeoEntry>();
export { extractHost };

function isCacheFresh(entry: GeoEntry): boolean {
  return Date.now() - entry.cachedAt < GEO_TTL_MS;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

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

export async function getGeoForHosts(
  hosts: Iterable<string>
): Promise<Map<string, GeoEntry>> {
  const uniqueHosts = Array.from(new Set(hosts));
  const hostsNeedingFetch = uniqueHosts.filter((host) => {
    const cached = geoCache.get(host);
    return !cached || !isCacheFresh(cached);
  });

  for (const chunk of chunkArray(hostsNeedingFetch, MAX_HOSTS_PER_BATCH)) {
    const { ips, ipToHost } = await resolveHostsToIps(chunk);
    if (ips.length > 0) {
      await fetchGeoForIps(ips, ipToHost);
    }
  }

  const result = new Map<string, GeoEntry>();
  for (const host of uniqueHosts) {
    const geo = geoCache.get(host);
    if (geo) result.set(host, geo);
  }
  return result;
}
