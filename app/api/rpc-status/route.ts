import { NextResponse } from 'next/server';

import { networkFromRequest, rateLimitResponse } from '@/lib/api-utils';
import { getRpcLatency } from '@/lib/iota';
import { clientKey, createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = createRateLimiter({ capacity: 30, refillPerSecond: 1 });

export async function GET(request: Request) {
  const { ok, retryAfterMs } = limiter.check(clientKey(request));
  if (!ok) {
    return rateLimitResponse(retryAfterMs);
  }

  try {
    const network = networkFromRequest(request);
    const data = await getRpcLatency(network);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=45',
      },
    });
  } catch (error) {
    console.error('RPC status API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RPC status' },
      { status: 500 }
    );
  }
}
