import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';

type ThemeMode = 'dark' | 'light';

interface ThemeModeToggleProps {
  compact?: boolean;
  className?: string;
}

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
  icon: typeof Moon;
}> = [
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'light', label: 'Claro', icon: Sun },
];

export function ThemeModeToggle({ compact = false, className }: ThemeModeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme: ThemeMode = (mounted ? theme || resolvedTheme : 'dark') === 'light' ? 'light' : 'dark';
  const ActiveIcon = activeTheme === 'light' ? Sun : Moon;
  const nextTheme: ThemeMode = activeTheme === 'light' ? 'dark' : 'light';

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setTheme(nextTheme)}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background/70 px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
          className,
        )}
        aria-label={`Alternar para tema ${nextTheme === 'light' ? 'claro' : 'escuro'}`}
        title={`Tema ${activeTheme === 'light' ? 'claro' : 'escuro'}`}
      >
        <ActiveIcon className="h-4 w-4 text-primary" />
        <span className="hidden sm:inline">{activeTheme === 'light' ? 'Claro' : 'Escuro'}</span>
      </button>
    );
  }

  return (
    <div
      className={cn('grid grid-cols-2 rounded-2xl border border-border bg-background/70 p-1', className)}
      role="group"
      aria-label="Tema da interface"
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const active = activeTheme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={active}
            className={cn(
              'flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
