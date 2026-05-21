import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

interface InteractiveHoverButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string;
}

export const InteractiveHoverButton = React.forwardRef<
  HTMLButtonElement,
  InteractiveHoverButtonProps
>(({ text = "Entrar", className, ...props }, ref) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "splash-enter-btn group relative cursor-pointer overflow-hidden rounded-full border border-primary/30 bg-background px-8 py-4 text-center text-lg font-medium text-primary transition-all duration-300",
        hovered ? "shadow-[0_0_30px_hsl(var(--primary)/0.4)]" : "",
        className
      )}
      style={{ opacity: 0 }}
      {...props}
    >
      {/* Sliding background */}
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center gap-3 bg-primary text-primary-foreground transition-all duration-500 ease-out",
          hovered ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {text}
        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
      </span>
      {/* Default text */}
      <span
        className={cn(
          "flex items-center justify-center gap-3 transition-all duration-300",
          hovered ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"
        )}
      >
        {text}
        <ArrowRight className="h-5 w-5" />
      </span>
    </button>
  );
});

InteractiveHoverButton.displayName = "InteractiveHoverButton";
