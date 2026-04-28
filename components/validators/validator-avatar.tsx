'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function ValidatorAvatar({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl: string;
}) {
  const initial = (name?.[0] ?? '?').toUpperCase();

  return (
    <Avatar className="size-8 border border-[rgba(223,142,255,0.4)]">
      {imageUrl && <AvatarImage src={imageUrl} alt={name} />}
      <AvatarFallback className="bg-linear-to-br from-[#6b1f8f] to-[#b325d6] text-xs font-bold text-white">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
