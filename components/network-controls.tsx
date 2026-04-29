'use client';

import { useEffect } from 'react';
import useSWR from 'swr';
import { Gauge, RadioTower } from 'lucide-react';

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { jsonFetcher } from '@/lib/client-fetcher';
import {
  IOTA_NETWORK_LABELS,
  IOTA_NETWORKS,
  type IotaNetwork,
} from '@/lib/iota-network';
import { useNetworkStore, withNetworkParam } from '@/lib/network-store';

type RpcStatus = {
  network: IotaNetwork;
  latencyMs: number;
};

const rpcStatusFetcher = async (url: string): Promise<RpcStatus> => {
  const startedAt = performance.now();
  const data = await jsonFetcher<RpcStatus>(url);
  return {
    ...data,
    latencyMs: data.latencyMs || Math.round(performance.now() - startedAt),
  };
};

export function NetworkControls() {
  const network = useNetworkStore((state) => state.network);
  const latencyMs = useNetworkStore((state) => state.latencyMs);
  const setNetwork = useNetworkStore((state) => state.setNetwork);
  const setLatencyMs = useNetworkStore((state) => state.setLatencyMs);

  const { data, error, isLoading } = useSWR<RpcStatus, Error>(
    withNetworkParam('/api/rpc-status', network),
    rpcStatusFetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      keepPreviousData: true,
      shouldRetryOnError: false,
    }
  );

  useEffect(() => {
    if (data?.latencyMs != null) {
      setLatencyMs(data.latencyMs);
    } else if (error) {
      setLatencyMs(null);
    }
  }, [data?.latencyMs, error, setLatencyMs]);

  const latencyLabel =
    latencyMs == null ? (isLoading ? '...' : 'n/a') : `${latencyMs}ms`;

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="px-2">Network</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={network}
          onValueChange={(value) => setNetwork(value as IotaNetwork)}
        >
          {IOTA_NETWORKS.map((value) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              className="h-8 px-2 pr-7"
            >
              <RadioTower className="size-4" />
              <span className="min-w-0 truncate">
                {IOTA_NETWORK_LABELS[value]}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuItem
          className="h-8 cursor-default px-2"
          disabled
        >
          <Gauge className="size-4" />
          <span>RPC</span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {latencyLabel}
          </span>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  );
}
