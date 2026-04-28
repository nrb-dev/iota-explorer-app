import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';

type PageBackButtonProps = {
  href: string;
  label: string;
  className?: string;
};

export function PageBackButton({ href, label, className }: PageBackButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      nativeButton={false}
      render={<Link href={href} />}
    >
      <ArrowLeft className="size-4" />
      {label}
    </Button>
  );
}
