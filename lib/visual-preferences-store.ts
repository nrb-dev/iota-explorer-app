'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type VisualPreferencesState = {
  globeArcsEnabled: boolean;
  setGlobeArcsEnabled: (enabled: boolean) => void;
};

export const useVisualPreferencesStore = create<VisualPreferencesState>()(
  persist(
    (set) => ({
      globeArcsEnabled: true,
      setGlobeArcsEnabled: (enabled) => set({ globeArcsEnabled: enabled }),
    }),
    {
      name: 'iota-visual-preferences',
    }
  )
);
