import 'server-only';

import type { IotaNetwork } from '@/lib/iota-network';
import { getRpcKey, getRpcUrl } from '@/lib/iota/rpc-config';

const RPC_TIMEOUT_MS = 10_000;
export const IOTA_COIN_TYPE = '0x2::iota::IOTA';

const isDev = process.env.NODE_ENV !== 'production';

export const log = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};

export type SystemStateShape = {
  epoch?: string;
  epochStartTimestampMs?: string;
  epochDurationMs?: string;
  totalStake?: string;
  referenceGasPrice?: string;
  activeValidators?: unknown[];
};

type SystemStateResult = {
  V2?: SystemStateShape;
} & SystemStateShape;

export async function rpcCall<T>(
  network: IotaNetwork,
  method: string,
  params: unknown[],
  revalidate = 60
): Promise<T | null> {
  const rpcUrl = getRpcUrl(network);
  const rpcKey = getRpcKey(network);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(rpcKey && { Authorization: `Bearer ${rpcKey}` }),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      next: { revalidate },
      signal: controller.signal,
    });

    if (!res.ok) {
      log(`⚠️ RPC ${network}:${method} returned ${res.status}`);
      return null;
    }

    const json = await res.json();
    if (json.error) {
      log(`⚠️ RPC ${network}:${method} error:`, json.error);
      return null;
    }

    return json.result as T;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      log(`⚠️ RPC ${network}:${method} timed out after ${RPC_TIMEOUT_MS}ms`);
    } else {
      log(`⚠️ RPC ${network}:${method} failed:`, err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSystemState(
  network: IotaNetwork
): Promise<SystemStateShape | null> {
  const result = await rpcCall<SystemStateResult>(
    network,
    'iotax_getLatestIotaSystemStateV2',
    []
  );
  if (!result) return null;
  // V2 wrapper varies between RPC providers.
  return result.V2 ?? result;
}
