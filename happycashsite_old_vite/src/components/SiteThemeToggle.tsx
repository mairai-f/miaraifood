import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

export function SiteThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = (mounted ? theme || resolvedTheme : "light") === "dark" ? "dark" : "light";
  const nextTheme = activeTheme === "dark" ? "light" : "dark";
  const Icon = activeTheme === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card/82 text-primary shadow-none backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label={`Alternar para tema ${nextTheme === "dark" ? "escuro" : "claro"}`}
      title={`Tema ${activeTheme === "dark" ? "escuro" : "claro"}`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
