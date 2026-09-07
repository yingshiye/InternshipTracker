"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function TooltipProvider({ children, delayDuration = 300 }: { children: React.ReactNode; delayDuration?: number }) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration}>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({ label, children, className }: { label: string; children: React.ReactElement; className?: string }) {
  // Disabled controls do not emit pointer/focus events, so Radix cannot open
  // a tooltip from the button itself. The neutral wrapper preserves the
  // disabled control while still making its explanation available on hover.
  const trigger = (children.props as { disabled?: boolean }).disabled ? (
    <span className="inline-flex">{children}</span>
  ) : (
    children
  );

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{trigger}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={6}
          className={cn(
            "z-[100] rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-sm dark:bg-gray-100 dark:text-gray-900",
            className,
          )}
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-gray-900 dark:fill-gray-100" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
