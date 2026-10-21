"use client";

import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Searchable dropdown with optional free-text ("custom") entry.
 * Used for city/industry/role pickers.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  allowCustom = false,
  customPlaceholder = "Type a custom value…",
  emptyText = "No matches.",
  disabled = false,
  className,
  id,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  customPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const trimmed = query.trim();
  const isCustom = allowCustom && trimmed.length > 0 && !options.includes(trimmed);
  const filtered = React.useMemo(() => {
    if (!trimmed) return options;
    const q = trimmed.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, trimmed]);

  const select = (next: string) => {
    onChange(next);
    close();
  };

  const display = value || placeholder;

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{display}</span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={4}
          align="start"
          className={cn(
            "z-50 max-h-72 w-[var(--radix-popover-trigger-width)] min-w-[12rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
            className
          )}
        >
          <div className="flex items-center gap-2 border-b px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isCustom) {
                  e.preventDefault();
                  select(trimmed);
                }
                if (e.key === "Escape") close();
              }}
              placeholder={customPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Search options"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1 scrollbar-thin">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  close();
                }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent"
              >
                Clear selection
              </button>
            )}
            {isCustom && (
              <button
                type="button"
                onClick={() => select(trimmed)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm font-medium hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5" />
                Use “{trimmed}”
              </button>
            )}
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => select(option)}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                  value === option && "bg-accent font-medium"
                )}
              >
                <span className="truncate">{option}</span>
                {value === option && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && !isCustom && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">{emptyText}</p>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
