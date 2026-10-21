"use client";

import { X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";

import { cn } from "@/lib/utils";

/** Slide-over drawer built on the Dialog primitive (used for the mobile sidebar). */
function Sheet({
  open,
  onOpenChange,
  children,
  side = "left",
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: "left" | "right";
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 z-50 flex w-[18rem] max-w-[85vw] flex-col border-r bg-sidebar text-sidebar-foreground shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=closed]:duration-200 data-[state=open]:duration-200",
            side === "right" &&
              "left-auto right-0 border-l border-r-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            className
          )}
        >
          {children}
          <DialogPrimitive.Close
            className="absolute right-3 top-3 rounded-md p-1 text-sidebar-foreground/70 opacity-70 transition-opacity hover:bg-sidebar-accent hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export { Sheet };
