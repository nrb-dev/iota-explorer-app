'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

import { cn } from '@/lib/utils';

const Particles = dynamic(
  () =>
    import('@/components/particles-background').then((mod) => mod.Particles),
  {
    ssr: false,
    loading: () => <StaticBackground className="z-0" />,
  }
);

function StaticBackground({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-0 overflow-hidden bg-linear-to-b from-slate-50 to-purple-200 dark:from-[#090909] dark:to-[#1a0b2e]',
        className
      )}
      aria-hidden="true"
    />
  );
}

export function AppBackground() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [quantity, setQuantity] = useState(72);

  useEffect(() => {
    const reduceMotionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );
    const mobileQuery = window.matchMedia('(max-width: 768px)');

    const sync = () => {
      setReducedMotion(reduceMotionQuery.matches);
      setQuantity(mobileQuery.matches ? 32 : 72);
    };

    sync();
    reduceMotionQuery.addEventListener('change', sync);
    mobileQuery.addEventListener('change', sync);
    return () => {
      reduceMotionQuery.removeEventListener('change', sync);
      mobileQuery.removeEventListener('change', sync);
    };
  }, []);

  if (reducedMotion) {
    return <StaticBackground className="z-0" />;
  }

  return (
    <Particles
      color="#b325d6"
      quantity={quantity}
      staticity={75}
      ease={70}
      className="z-0 pointer-events-none"
    />
  );
}
