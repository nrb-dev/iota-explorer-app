import { NextResponse } from 'next/server';

import {
  CACHE_HEADERS,
  cachedJson,
  networkFromRequest,
  rateLimitResponse,
} from '@/lib/api-utils';
import { getEpochData } from '@/lib/iota';
import { clientKey, createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = createRateLimiter({ capacity: 20, refillPerSecond: 1 });

export async function GET(request: Request) {
  const { ok, retryAfterMs } = limiter.check(clientKey(request));
  if (!ok) {
    return rateLimitResponse(retryAfterMs);
  }

  try {
    const network = networkFromRequest(request);
    const data = await getEpochData(network);
    return cachedJson(data, CACHE_HEADERS.epoch);
  } catch (error) {
    console.error('Epoch API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch epoch data' },
      { status: 500 }
    );
  }
}
