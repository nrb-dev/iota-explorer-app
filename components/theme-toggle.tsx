'use client';
import { Button } from './ui/button';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { SunMoonIcon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" className="rounded-sm p-5 w-full" disabled />
    );
  }

  return (
    <Button
      variant="ghost"
      className="rounded-sm p-5 w-full"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <SunMoonIcon className="h-[1.2rem] w-[1.2rem]" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
