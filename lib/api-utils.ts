import { NextResponse } from 'next/server';

import { parseIotaNetwork } from '@/lib/iota-network';

export const CACHE_HEADERS = {
  validators: 'public, s-maxage=60, stale-while-revalidate=300',
  network: 'public, s-maxage=60, stale-while-revalidate=300',
  epochs: 'public, s-maxage=300, stale-while-revalidate=600',
  epoch: 'public, s-maxage=300, stale-while-revalidate=600',
  rpcStatus: 'public, s-maxage=15, stale-while-revalidate=45',
  transactions: 'public, s-maxage=5, stale-while-revalidate=10',
} as const;

export function networkFromRequest(request: Request) {
  const { searchParams } = new URL(request.url);
  return parseIotaNetwork(searchParams.get('network'));
}

export function cachedJson<T>(data: T, cacheControl: string) {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': cacheControl,
    },
  });
}

export function rateLimitResponse(retryAfterMs: number) {
  return NextResponse.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) },
    }
  );
}
