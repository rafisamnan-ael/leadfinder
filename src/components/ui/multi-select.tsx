"use client";

import { X } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Checkbox-style multi-select rendered as an add-button + chips. */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select options",
  maxChips = 4,
  className,
  allowAll = false,
  allLabel = "All",
  onAll,
  allActive = false,
}: {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxChips?: number;
  className?: string;
  allowAll?: boolean;
  allLabel?: string;
  onAll?: () => void;
  allActive?: boolean;
}) {
  const toggle = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  const overflow = Math.max(0, value.length - maxChips);

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {value.slice(0, maxChips).map((v) => (
        <Badge key={v} variant="secondary" className="max-w-[10rem]">
          <span className="truncate">{v}</span>
          <button
            type="button"
            aria-label={`Remove ${v}`}
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="rounded-full hover:text-destructive focus:outline-none"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {overflow > 0 && <Badge variant="muted">+{overflow} more</Badge>}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-7">
            {value.length > 0 ? `${value.length} selected` : placeholder}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-72 w-56 overflow-y-auto" align="start">
          <DropdownMenuLabel>{placeholder}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {allowAll && (
            <>
              <DropdownMenuCheckboxItem
                checked={allActive}
                onSelect={(e) => {
                  e.preventDefault();
                  onAll?.();
                }}
              >
                {allLabel}
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
            </>
          )}
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option}
              checked={value.includes(option)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => toggle(option)}
            >
              <span className="truncate">{option}</span>
            </DropdownMenuCheckboxItem>
          ))}
          {options.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No options.</p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
