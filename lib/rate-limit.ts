/**
 * In-memory token-bucket rate limiter, keyed by client identifier.
 *
 * On serverless platforms (Vercel) state is per-instance, so this is a soft
 * limit, not a hard ceiling — enough to deter casual abuse and stop a single
 * misbehaving client from exhausting the upstream RPC quota. For production
 * hardening swap this for Upstash Redis or Vercel KV.
 */
import 'server-only';

type Bucket = {
  tokens: number;
  lastRefill: number;
  lastSeen: number;
};

type Limiter = {
  check: (key: string) => { ok: boolean; retryAfterMs: number };
};

export function createRateLimiter(opts: {
  capacity: number;
  refillPerSecond: number;
  idleTtlMs?: number;
  sweepIntervalMs?: number;
}): Limiter {
  const buckets = new Map<string, Bucket>();
  const refillRate = opts.refillPerSecond / 1000; // tokens per ms
  const idleTtlMs = opts.idleTtlMs ?? 10 * 60 * 1000;
  const sweepIntervalMs = opts.sweepIntervalMs ?? 60 * 1000;
  let lastSweep = 0;

  const sweep = (now: number) => {
    if (now - lastSweep < sweepIntervalMs) return;
    lastSweep = now;
    for (const [key, bucket] of buckets) {
      if (now - bucket.lastSeen > idleTtlMs) {
        buckets.delete(key);
      }
    }
  };

  return {
    check(key) {
      const now = Date.now();
      sweep(now);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { tokens: opts.capacity, lastRefill: now, lastSeen: now };
        buckets.set(key, bucket);
      }

      const elapsed = now - bucket.lastRefill;
      bucket.tokens = Math.min(
        opts.capacity,
        bucket.tokens + elapsed * refillRate
      );
      bucket.lastRefill = now;
      bucket.lastSeen = now;

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { ok: true, retryAfterMs: 0 };
      }

      const retryAfterMs = Math.ceil((1 - bucket.tokens) / refillRate);
      return { ok: false, retryAfterMs };
    },
  };
}

function firstHeader(req: Request, names: string[]): string | null {
  for (const name of names) {
    const value = req.headers.get(name);
    if (value) return value.trim();
  }
  return null;
}

/**
 * Best-effort client key from trusted platform headers.
 * `x-forwarded-for` is intentionally opt-in because clients can spoof it when
 * the app is not behind a trusted proxy that overwrites incoming values.
 */
export function clientKey(req: Request): string {
  const trustedIp = firstHeader(req, [
    'cf-connecting-ip',
    'fly-client-ip',
    'x-vercel-forwarded-for',
    'x-real-ip',
  ]);
  if (trustedIp) return trustedIp;

  if (process.env.TRUST_X_FORWARDED_FOR === 'true') {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
  }

  return 'anonymous';
}
