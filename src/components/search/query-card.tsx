"use client";

import {
  Copy,
  ExternalLink,
  Map as MapIcon,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_LABELS, type CategoryId, type GeneratedSearch } from "@/lib/query-engine";
import { cn, copyToClipboard, timeAgo } from "@/lib/utils";

export function QueryCard({
  search,
  favorite,
  onToggleFavorite,
  onSearch,
  index,
  loggedAt,
}: {
  search: GeneratedSearch;
  favorite: boolean;
  onToggleFavorite: () => void;
  onSearch: () => void;
  index: number;
  loggedAt?: string;
}) {
  const isMaps = search.engine === "maps";

  const copy = async () => {
    const ok = await copyToClipboard(search.query);
    if (ok) toast.success("Query copied");
    else toast.error("Could not copy to clipboard");
  };

  return (
    <Card
      className={cn(
        "group flex flex-col transition-shadow hover:shadow-md",
        index === 0 && "border-primary/30"
      )}
    >
      <CardHeader className="gap-2 space-y-0 p-4 pb-2.5">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-[13px] font-semibold leading-snug">{search.name}</CardTitle>
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={favorite ? "Remove template from favorites" : "Add template to favorites"}
            aria-pressed={favorite}
            className={cn(
              "rounded-md p-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              favorite ? "text-warning" : "text-muted-foreground/50 hover:text-foreground"
            )}
          >
            <Star className={cn("h-4 w-4", favorite && "fill-current")} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="muted" className="text-[10px]">
            {(CATEGORY_LABELS[search.category as CategoryId] ?? search.category).split(" · ")[0]}
          </Badge>
          <Badge variant={isMaps ? "info" : "secondary"} className="gap-1 text-[10px]">
            {isMaps ? <MapIcon className="h-3 w-3" /> : null}
            {isMaps ? "Google Maps" : "Google"}
          </Badge>
          {loggedAt && (
            <span className="text-[10px] text-muted-foreground">run {timeAgo(loggedAt)}</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-2.5 p-4 pt-2">
        <p className="text-xs leading-relaxed text-muted-foreground">{search.description}</p>
        <div
          className="scrollbar-thin max-h-28 overflow-y-auto rounded-lg border bg-muted/50 p-2.5 font-mono text-[11.5px] leading-relaxed break-all whitespace-pre-wrap"
          title={search.query}
        >
          {search.query}
        </div>
      </CardContent>

      <CardFooter className="gap-2 p-4 pt-0">
        <Button type="button" size="sm" variant="outline" className="h-8 flex-1" onClick={copy}>
          <Copy className="h-3.5 w-3.5" />
          Copy
        </Button>
        <Button type="button" size="sm" className="h-8 flex-1" onClick={onSearch}>
          <ExternalLink className="h-3.5 w-3.5" />
          Search
        </Button>
      </CardFooter>
    </Card>
  );
}
