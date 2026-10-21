"use client";

import {
  AlertTriangle,
  Copy,
  FileSearch,
  Map as MapIcon,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { TemplateFormDialog } from "@/components/templates/template-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiSend } from "@/lib/client";
import type { TemplateDto } from "@/lib/mappers";
import { CATEGORY_LABELS, SEARCH_SOURCES, type CategoryId } from "@/lib/query-engine";
import { cn } from "@/lib/utils";

const ALL_CATEGORIES = "all";
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as CategoryId[];
const SOURCE_LABEL_BY_ID: Record<string, string> = Object.fromEntries(
  SEARCH_SOURCES.map((s) => [s.id, s.label])
);

/** "A · LinkedIn Founder/Owner Profiles" → "LinkedIn Founder/Owner Profiles". */
function shortCategoryLabel(category: string): string {
  const full = CATEGORY_LABELS[category as CategoryId] ?? category;
  return full.includes(" · ") ? full.split(" · ").slice(1).join(" · ") : full;
}

export function TemplatesView() {
  const [templates, setTemplates] = React.useState<TemplateDto[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string>(ALL_CATEGORIES);
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TemplateDto | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<TemplateDto | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const data = await apiGet<{ items: TemplateDto[] }>("/api/templates");
      setTemplates(data.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load templates");
      setTemplates([]);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const list = React.useMemo(() => templates ?? [], [templates]);

  const favorites = React.useMemo(
    () => list.filter((t) => t.isFavorite).length,
    [list]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((t) => {
      if (favoritesOnly && !t.isFavorite) return false;
      if (category !== ALL_CATEGORIES && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.template.toLowerCase().includes(q)
      );
    });
  }, [list, query, category, favoritesOnly]);

  const clearFilters = () => {
    setQuery("");
    setCategory(ALL_CATEGORIES);
    setFavoritesOnly(false);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (t: TemplateDto) => {
    setEditing(t);
    setFormOpen(true);
  };

  const toggleFavorite = async (t: TemplateDto) => {
    const next = !t.isFavorite;
    setTemplates((current) =>
      (current ?? []).map((x) => (x.id === t.id ? { ...x, isFavorite: next } : x))
    );
    try {
      await apiSend("PUT", `/api/templates/${t.id}`, { isFavorite: next });
      toast.success(next ? "Added to favorites" : "Removed from favorites");
    } catch (e) {
      setTemplates((current) =>
        (current ?? []).map((x) => (x.id === t.id ? { ...x, isFavorite: t.isFavorite } : x))
      );
      toast.error(e instanceof Error ? e.message : "Could not update favorite");
    }
  };

  const duplicate = async (t: TemplateDto) => {
    try {
      await apiSend("POST", "/api/templates", {
        name: `${t.name} (copy)`,
        description: t.description,
        category: t.category,
        template: t.template,
        engine: t.engine === "maps" ? "maps" : "google",
        sources: t.sources,
        isFavorite: false,
      });
      toast.success("Template duplicated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not duplicate template");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiSend("DELETE", `/api/templates/${deleteTarget.id}`);
      toast.success("Template deleted");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete template");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Search Templates</h2>
          <p className="text-sm text-muted-foreground">
            {templates === null
              ? "Loading templates…"
              : `${list.length} template${list.length === 1 ? "" : "s"} · ${favorites} favorite${favorites === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button type="button" size="sm" className="h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New template
        </Button>
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates…"
          aria-label="Search templates"
          className="h-9 w-full max-w-xs"
        />

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-[220px]" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
            {CATEGORY_OPTIONS.map((id) => (
              <SelectItem key={id} value={id}>
                {CATEGORY_LABELS[id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly((v) => !v)}
        >
          <Star className={cn("h-4 w-4", favoritesOnly && "fill-warning text-warning")} />
          Favorites only
        </Button>
      </div>

      {/* error */}
      {error && (
        <EmptyState
          icon={AlertTriangle}
          title="Could not load templates"
          description={error}
          action={
            <Button type="button" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      )}

      {/* loading */}
      {!error && templates === null && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-16 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* empty database */}
      {!error && templates !== null && list.length === 0 && (
        <EmptyState
          icon={FileSearch}
          title="No templates yet"
          description="Create your first search template to reuse a query pattern across industries and cities."
          action={
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create template
            </Button>
          }
        />
      )}

      {/* empty filtered result */}
      {!error && templates !== null && list.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={Search}
          title="No templates match"
          description="Try a different search term, category or turn off the favorites filter."
          action={
            <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      )}

      {/* grid */}
      {!error && templates !== null && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((t) => {
            const sourceLabels = t.sources.map(
              (id) => SOURCE_LABEL_BY_ID[id] ?? id
            );
            const shown = sourceLabels.slice(0, 3);
            const overflow = sourceLabels.length - shown.length;

            return (
              <Card key={t.id} className="flex flex-col shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle
                        className="truncate text-[13.5px] font-semibold"
                        title={t.name}
                      >
                        {t.name}
                      </CardTitle>
                      {t.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={
                        t.isFavorite
                          ? `Remove ${t.name} from favorites`
                          : `Add ${t.name} to favorites`
                      }
                      aria-pressed={t.isFavorite}
                      className={cn("shrink-0", t.isFavorite && "text-warning")}
                      onClick={() => void toggleFavorite(t)}
                    >
                      <Star className={cn("h-4 w-4", t.isFavorite && "fill-current")} />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="secondary"
                      title={CATEGORY_LABELS[t.category as CategoryId] ?? t.category}
                    >
                      {shortCategoryLabel(t.category)}
                    </Badge>

                    <Badge variant="outline">
                      {t.engine === "maps" && <MapIcon />}
                      {t.engine === "maps" ? "Google Maps" : "Google"}
                    </Badge>

                    <Badge variant={t.isSystem ? "muted" : "secondary"}>
                      {t.isSystem ? "Built-in" : "Custom"}
                    </Badge>

                    {shown.map((label) => (
                      <Badge key={label} variant="muted">
                        {label}
                      </Badge>
                    ))}
                    {overflow > 0 && <Badge variant="muted">+{overflow}</Badge>}
                  </div>

                  <div className="scrollbar-thin max-h-24 overflow-y-auto rounded-lg border bg-muted/50 p-2.5 font-mono text-[11.5px] break-all whitespace-pre-wrap">
                    {t.template}
                  </div>
                </CardContent>

                <div className="flex flex-wrap items-center gap-1.5 border-t px-5 py-3">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/search">
                      <Search className="h-3.5 w-3.5" />
                      Use
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void duplicate(t)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Duplicate
                  </Button>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${t.name}`}
                      onClick={() => openEdit(t)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${t.name}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* create / edit */}
      <TemplateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editing}
        onSaved={() => void load()}
      />

      {/* delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.name}” will be removed permanently. This cannot be undone.
              {deleteTarget?.isSystem &&
                " Built-in template — re-seeding will not restore it."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={deleting}
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
