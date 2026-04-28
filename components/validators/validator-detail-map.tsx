import { MapPin } from 'lucide-react';

import type { Validator } from '@/components/globe/types';
import { Badge } from '@/components/ui/badge';

export function ValidatorDetailMap({ validator }: { validator: Validator }) {
  const hasGeo = validator.lat != null && validator.lng != null;
  const lat = validator.lat ?? 0;
  const lng = validator.lng ?? 0;
  const left = hasGeo ? ((lng + 180) / 360) * 100 : 50;
  const top = hasGeo ? ((90 - lat) / 180) * 100 : 50;

  return (
    <div className="relative min-h-56 overflow-hidden rounded-xl border bg-muted/40">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(179,37,214,0.24),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.08),transparent_45%),repeating-linear-gradient(0deg,transparent,transparent_23px,rgba(120,113,108,0.16)_24px),repeating-linear-gradient(90deg,transparent,transparent_23px,rgba(120,113,108,0.16)_24px)]" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-border/70" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-border/70" />

      <div
        className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        style={{ left: `${left}%`, top: `${top}%` }}
      >
        <span className="absolute size-9 rounded-full bg-primary/20" />
        <span className="absolute size-5 rounded-full bg-primary/30" />
        <MapPin className="relative size-6 fill-primary text-primary" />
      </div>

      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {validator.city ? `${validator.city}, ` : ''}
          {validator.country}
        </Badge>
        {hasGeo && (
          <Badge variant="outline" className="font-mono">
            {validator.lat?.toFixed(2)}, {validator.lng?.toFixed(2)}
          </Badge>
        )}
      </div>
    </div>
  );
}
