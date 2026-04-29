import { NextResponse } from 'next/server';

import {
  CACHE_HEADERS,
  cachedJson,
  networkFromRequest,
  rateLimitResponse,
} from '@/lib/api-utils';
import { getRecentTransactions } from '@/lib/iota';
import { clientKey, createRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = createRateLimiter({ capacity: 30, refillPerSecond: 2 });

export async function GET(request: Request) {
  const { ok, retryAfterMs } = limiter.check(clientKey(request));
  if (!ok) return rateLimitResponse(retryAfterMs);

  try {
    const network = networkFromRequest(request);
    const data = await getRecentTransactions(network, 25);
    return cachedJson(
      { network, transactions: data },
      CACHE_HEADERS.transactions
    );
  } catch (error) {
    console.error('Transactions API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
