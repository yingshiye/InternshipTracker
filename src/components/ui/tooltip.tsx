"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function TooltipProvider({ children, delayDuration = 300 }: { children: React.ReactNode; delayDuration?: number }) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration}>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({ label, children, className }: { label: string; children: React.ReactElement; className?: string }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
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
