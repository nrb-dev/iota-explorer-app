import { NextResponse } from 'next/server';

import { parseIotaNetwork } from '@/lib/iota-network';

export function networkFromRequest(request: Request) {
  const { searchParams } = new URL(request.url);
  return parseIotaNetwork(searchParams.get('network'));
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
