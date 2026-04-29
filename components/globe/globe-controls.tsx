'use client';

import { Orbit } from 'lucide-react';

import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useVisualPreferencesStore } from '@/lib/visual-preferences-store';

export function GlobeControls() {
  const globeArcsEnabled = useVisualPreferencesStore(
    (state) => state.globeArcsEnabled
  );
  const setGlobeArcsEnabled = useVisualPreferencesStore(
    (state) => state.setGlobeArcsEnabled
  );

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="px-2">Globe effects</DropdownMenuLabel>
      <DropdownMenuCheckboxItem
        checked={globeArcsEnabled}
        onCheckedChange={setGlobeArcsEnabled}
        className="h-8 px-2 pr-7"
      >
        <Orbit className="size-4" />
        <span className="min-w-0 truncate">Line arcs</span>
      </DropdownMenuCheckboxItem>
    </DropdownMenuGroup>
  );
}
