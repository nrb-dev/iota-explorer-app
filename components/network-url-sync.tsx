'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

import { isIotaNetwork } from '@/lib/iota-network';
import { useNetworkStore } from '@/lib/network-store';

export function NetworkUrlSync() {
  const searchParams = useSearchParams();
  const network = useNetworkStore((state) => state.network);
  const setNetwork = useNetworkStore((state) => state.setNetwork);
  const urlNetwork = searchParams.get('network');

  useEffect(() => {
    if (isIotaNetwork(urlNetwork) && urlNetwork !== network) {
      setNetwork(urlNetwork);
    }
  }, [network, setNetwork, urlNetwork]);

  return null;
}
