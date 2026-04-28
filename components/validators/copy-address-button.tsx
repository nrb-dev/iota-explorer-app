'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatAddress } from '@/lib/formatters';

export function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopyFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
      setCopyFailed(true);
      window.setTimeout(() => setCopyFailed(false), 1600);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-w-full font-mono"
            onClick={copy}
          />
        }
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
        <span className="truncate">{formatAddress(address, 8)}</span>
      </TooltipTrigger>
      <TooltipContent>
        {copyFailed ? 'Copy failed' : copied ? 'Copied' : 'Copy address'}
      </TooltipContent>
    </Tooltip>
  );
}
