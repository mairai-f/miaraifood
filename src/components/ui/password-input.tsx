import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  toggleClassName?: string;
  showAriaLabel?: string;
  hideAriaLabel?: string;
};

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      toggleClassName,
      showAriaLabel = "Mostrar senha",
      hideAriaLabel = "Ocultar senha",
      ...props
    },
    ref,
  ) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground",
            toggleClassName,
          )}
          aria-label={visible ? hideAriaLabel : showAriaLabel}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
