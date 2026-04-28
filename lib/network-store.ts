'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { IotaNetwork } from '@/lib/iota-network';
export { withNetworkParam } from '@/lib/iota-network';

type NetworkState = {
  network: IotaNetwork;
  latencyMs: number | null;
  setNetwork: (network: IotaNetwork) => void;
  setLatencyMs: (latencyMs: number | null) => void;
};

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set) => ({
      network: 'mainnet',
      latencyMs: null,
      setNetwork: (network) => set({ network, latencyMs: null }),
      setLatencyMs: (latencyMs) => set({ latencyMs }),
    }),
    {
      name: 'iota-na-network',
      partialize: (state) => ({ network: state.network }),
    }
  )
);
