'use client';

import { useState } from 'react';

export function ValidatorAvatar({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl: string;
}) {
  const [imgError, setImgError] = useState(false);
  const initial = (name?.[0] ?? '?').toUpperCase();

  if (!imageUrl || imgError) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#6b1f8f] to-[#b325d6] border border-[rgba(223,142,255,0.4)]">
        <span className="text-xs font-bold text-white">{initial}</span>
      </div>
    );
  }

  return (
    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[rgba(223,142,255,0.4)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={name}
        className="h-full w-full object-cover"
        onError={() => setImgError(true)}
        loading="lazy"
      />
    </div>
  );
}
