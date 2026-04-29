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
      <Button variant="ghost" className="h-8 w-full justify-start rounded-md px-2" disabled />
    );
  }

  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant="ghost"
      className="h-8 w-full justify-start rounded-md px-2"
      onClick={() => setTheme(nextTheme)}
    >
      <SunMoonIcon className="size-4" />
      <span>Theme</span>
      <span className="ml-auto text-xs text-muted-foreground">
        {theme === 'dark' ? 'Dark' : 'Light'}
      </span>
    </Button>
  );
}
