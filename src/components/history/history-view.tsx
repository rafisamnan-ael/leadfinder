"use client";

import {
  AlertTriangle,
  Copy,
  ExternalLink,
  History,
  Map as MapIcon,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, apiSend } from "@/lib/client";
import type { HistoryDto } from "@/lib/mappers";
import { buildGoogleUrl, buildMapsUrl } from "@/lib/query-engine";
import { cn, copyToClipboard, timeAgo } from "@/lib/utils";

type TabId = "all" | "saved";

interface ConfirmState {
  kind: TabId;
  count: number;
}

export function HistoryView() {
  const [items, setItems] = React.useState<HistoryDto[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<TabId>("all");
  const [query, setQuery] = React.useState("");
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null);
  const [clearing, setClearing] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const data = await apiGet<{ items: HistoryDto[] }>("/api/searches?limit=200");
      setItems(data.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load search history");
      setItems([]);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const list = React.useMemo(() => items ?? [], [items]);

  const savedCount = React.useMemo(
    () => list.filter((i) => i.saved).length,
    [list]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((i) => {
      if (tab === "saved" && !i.saved) return false;
      if (!q) return true;
      return (
        i.query.toLowerCase().includes(q) ||
        (i.label ?? "").toLowerCase().includes(q)
      );
    });
  }, [list, tab, query]);

  const runItem = (item: HistoryDto) => {
    const url =
      item.engine === "maps" ? buildMapsUrl(item.query) : buildGoogleUrl(item.query);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyItem = async (item: HistoryDto) => {
    const ok = await copyToClipboard(item.query);
    if (ok) {
      toast.success("Query copied");
    } else {
      toast.error("Could not copy");
    }
  };

  const toggleSaved = async (item: HistoryDto) => {
    const next = !item.saved;
    setItems((current) =>
      (current ?? []).map((x) => (x.id === item.id ? { ...x, saved: next } : x))
    );
    try {
      await apiSend("PATCH", `/api/searches/${item.id}`, { saved: next });
    } catch (e) {
      setItems((current) =>
        (current ?? []).map((x) => (x.id === item.id ? { ...x, saved: item.saved } : x))
      );
      toast.error(e instanceof Error ? e.message : "Could not update saved search");
    }
  };

  const removeItem = async (item: HistoryDto) => {
    setItems((current) => (current ?? []).filter((x) => x.id !== item.id));
    try {
      await apiSend("DELETE", `/api/searches/${item.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete history entry");
      await load();
    }
  };

  const clearScope = async (kind: TabId) => {
    const scope = kind === "saved" ? "saved" : "all";
    setClearing(true);
    try {
      const res = await apiSend<{ count: number }>(
        "DELETE",
        `/api/searches?scope=${scope}`
      );
      toast.success(
        kind === "saved"
          ? `Removed ${res.count} saved ${res.count === 1 ? "entry" : "entries"}`
          : `Removed ${res.count} ${res.count === 1 ? "entry" : "entries"}`
      );
      setConfirm(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear history");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Search History</h2>
          <Badge variant="muted">{items === null ? "…" : list.length}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {savedCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-destructive hover:text-destructive"
              onClick={() => setConfirm({ kind: "saved", count: savedCount })}
            >
              <Star className="h-4 w-4" />
              Clear saved
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-destructive hover:text-destructive"
            onClick={() => setConfirm({ kind: "all", count: list.length })}
          >
            <Trash2 className="h-4 w-4" />
            Clear history
          </Button>
        </div>
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="saved" className="text-xs">
              Saved ({savedCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search history…"
          aria-label="Search history"
          className="h-9 w-full max-w-xs"
        />
      </div>

      {/* error */}
      {error && (
        <EmptyState
          icon={AlertTriangle}
          title="Could not load search history"
          description={error}
          action={
            <Button type="button" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      )}

      {/* loading */}
      {!error && items === null && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="shadow-none">
              <div className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-8 w-28" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* no history at all */}
      {!error && items !== null && list.length === 0 && (
        <EmptyState
          icon={History}
          title="No search history yet"
          description="Run searches from Lead Search to build history."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/search">
                <Search className="h-4 w-4" />
                Open Lead Search
              </Link>
            </Button>
          }
        />
      )}

      {/* no matches */}
      {!error && items !== null && list.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={Search}
          title="No history entries match"
          description="Try another search term or switch back to the All tab."
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setQuery("");
                setTab("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      )}

      {/* list */}
      {!error && items !== null && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((item) => (
            <Card key={item.id} className="group shadow-none">
              <div className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-mono text-[11.5px] text-foreground/90"
                    title={item.query}
                  >
                    {item.query}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-muted-foreground">
                    <Badge variant="muted">
                      {item.engine === "maps" && <MapIcon />}
                      {item.engine === "maps" ? "Maps" : "Google"}
                    </Badge>
                    {item.label && <span className="truncate">{item.label}</span>}
                    {item.templateName && (
                      <Badge
                        variant="outline"
                        className="max-w-[14rem] truncate"
                        title={item.templateName}
                      >
                        {item.templateName}
                      </Badge>
                    )}
                    {item.saved && (
                      <>
                        <Star
                          className="h-3 w-3 fill-warning text-warning"
                          aria-hidden
                        />
                        <span className="sr-only">Saved</span>
                      </>
                    )}
                    <span>{timeAgo(item.createdAt)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Run this search again"
                    className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => runItem(item)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy query"
                    className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => void copyItem(item)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={item.saved ? "Remove from saved" : "Save search"}
                    aria-pressed={item.saved}
                    className={
                      item.saved
                        ? "text-warning opacity-100"
                        : "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    }
                    onClick={() => void toggleSaved(item)}
                  >
                    <Star className={cn("h-3.5 w-3.5", item.saved && "fill-current")} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete from history"
                    className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => void removeItem(item)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* clear confirmation */}
      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent maxWidth="sm">
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === "saved" ? "Clear saved searches?" : "Clear search history?"}
            </DialogTitle>
            <DialogDescription>
              {confirm?.kind === "saved" ? (
                <>
                  This will permanently remove {confirm?.count ?? 0} saved{" "}
                  {(confirm?.count ?? 0) === 1 ? "entry" : "entries"}. Your other history entries
                  stay untouched.
                </>
              ) : (
                <>
                  This will permanently remove all {confirm?.count ?? 0}{" "}
                  {(confirm?.count ?? 0) === 1 ? "entry" : "entries"} from your search history.
                  This cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirm(null)}
              disabled={clearing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={clearing}
              onClick={() => {
                if (confirm) void clearScope(confirm.kind);
              }}
            >
              Clear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
