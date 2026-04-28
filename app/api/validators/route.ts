/**
 * Public proxy in front of IOTA RPC. Three jobs:
 *  1. Hide the upstream RPC URL/key from the client bundle.
 *  2. Apply per-IP rate limit so one bad actor can't exhaust the RPC quota.
 *  3. Set Cache-Control so the CDN absorbs duplicate traffic.
 *
 * The actual RPC + geo logic lives in `lib/iota.ts` and is shared with
 * server-rendered pages (e.g. `/validators/[address]`).
 */
import { NextResponse } from 'next/server';
import { getValidatorsData } from '@/lib/iota';
import { networkFromRequest, rateLimitResponse } from '@/lib/api-utils';
import { clientKey, createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// 60 requests per minute per IP, with a small burst allowance.
const limiter = createRateLimiter({ capacity: 10, refillPerSecond: 1 });

export async function GET(request: Request) {
  const { ok, retryAfterMs } = limiter.check(clientKey(request));
  if (!ok) {
    return rateLimitResponse(retryAfterMs);
  }

  try {
    const network = networkFromRequest(request);
    const data = await getValidatorsData(network);
    return NextResponse.json(data, {
      headers: {
        // CDN holds for 60s, serves stale for 5 min while revalidating.
        // Validator data is per-epoch (~24h), so a fresher TTL is overkill.
        'Cache-Control':
          'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Validator API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch validator data' },
      { status: 500 }
    );
  }
}
