import { NextResponse } from 'next/server';

import { networkFromRequest, rateLimitResponse } from '@/lib/api-utils';
import { getNetworkData } from '@/lib/iota';
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
    const data = await getNetworkData(network);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Network API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch network data' },
      { status: 500 }
    );
  }
}
