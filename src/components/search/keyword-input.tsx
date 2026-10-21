"use client";

import { Plus, X } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Chips input: type a keyword, press Enter/comma to add. */
export function KeywordInput({
  value,
  onChange,
  placeholder,
  tone = "default",
  className,
  id,
  ariaLabel,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  tone?: "default" | "exclude";
  className?: string;
  id?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = React.useState("");

  const add = (raw: string) => {
    const term = raw.replace(/["“”]/g, "").trim();
    if (!term) return;
    if (value.some((v) => v.toLowerCase() === term.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, term]);
    setDraft("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring/60",
        className
      )}
    >
      {value.map((kw) => (
        <Badge
          key={kw}
          variant={tone === "exclude" ? "destructive" : "secondary"}
          className="pr-0.5"
        >
          {tone === "exclude" ? "-" : ""}
          {kw}
          <button
            type="button"
            onClick={() => onChange(value.filter((v) => v !== kw))}
            aria-label={`Remove keyword ${kw}`}
            className="ml-0.5 rounded-full p-0.5 hover:bg-background/30 focus:outline-none"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <div className="flex min-w-[7rem] flex-1 items-center gap-1">
        {value.length > 0 && (
          <span className="text-xs text-muted-foreground" aria-hidden>
            {tone === "exclude" ? "-" : "+"}
          </span>
        )}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length === 0 ? placeholder : "Add more…"}
          aria-label={ariaLabel ?? placeholder}
          className="h-6 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={() => add(draft)}
          tabIndex={-1}
          aria-hidden
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
