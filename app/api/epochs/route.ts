import { NextResponse } from 'next/server';

import { networkFromRequest, rateLimitResponse } from '@/lib/api-utils';
import { getEpochs } from '@/lib/iota';
import { clientKey, createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = createRateLimiter({ capacity: 20, refillPerSecond: 1 });

export async function GET(request: Request) {
  const { ok, retryAfterMs } = limiter.check(clientKey(request));
  if (!ok) return rateLimitResponse(retryAfterMs);

  try {
    const network = networkFromRequest(request);
    const data = await getEpochs(network, 30);
    return NextResponse.json(
      { network, epochs: data },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('Epochs API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch epochs' },
      { status: 500 }
    );
  }
}
