"use client";

import {
  AlertTriangle,
  Copy,
  History,
  Layers,
  Loader2,
  Play,
  Rocket,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { FilterPanel } from "@/components/search/filter-panel";
import { QueryCard } from "@/components/search/query-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiSend } from "@/lib/client";
import type { HistoryDto, TemplateDto } from "@/lib/mappers";
import {
  buildGoogleQuery,
  buildGoogleUrl,
  buildMapsQuery,
  buildMapsUrl,
  describeFilters,
  EMPTY_FILTERS,
  generateSearches,
  hasMinimumFilters,
  isUsableQuery,
  type GeneratedSearch,
  type QueryFilters,
  type TemplateDef,
} from "@/lib/query-engine";
import type { SettingsInput } from "@/lib/validations";
import { cn, copyToClipboard, timeAgo } from "@/lib/utils";

const OPEN_ALL_LIMIT = 12;

export function SearchWorkspace() {
  const [filters, setFilters] = React.useState<QueryFilters>(EMPTY_FILTERS);
  const [templates, setTemplates] = React.useState<TemplateDto[] | null>(null);
  const [recent, setRecent] = React.useState<HistoryDto[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [savingSearch, setSavingSearch] = React.useState(false);
  const [customTemplate, setCustomTemplate] = React.useState("");
  const [customEngine, setCustomEngine] = React.useState<"google" | "maps">("google");
  const [showCustom, setShowCustom] = React.useState(false);
  const defaultsApplied = React.useRef(false);

  /* ---------------- data loading ---------------- */

  const loadRecent = React.useCallback(async () => {
    try {
      const data = await apiGet<{ items: HistoryDto[] }>("/api/searches?limit=6");
      setRecent(data.items);
    } catch {
      /* recent searches are non-critical */
    }
  }, []);

  const loadAll = React.useCallback(async () => {
    setError(null);
    setTemplates(null);
    try {
      const [tpl, settings] = await Promise.all([
        apiGet<{ items: TemplateDto[] }>("/api/templates"),
        apiGet<SettingsInput>("/api/settings").catch(() => null),
      ]);
      setTemplates(tpl.items);
      if (settings && !defaultsApplied.current) {
        defaultsApplied.current = true;
        setFilters((f) => ({
          ...f,
          country: settings.defaultCountry || f.country,
          industry: settings.defaultIndustry || f.industry,
          city: settings.defaultCity || f.city,
          appendSizeKeywords: settings.appendSizeKeywords ?? f.appendSizeKeywords,
          dateRange: (settings.dateRange ?? "") as QueryFilters["dateRange"],
        }));
      }
      await loadRecent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load templates");
    }
  }, [loadRecent]);

  React.useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /* ---------------- derived ---------------- */

  const engineDefs = React.useMemo(
    () =>
      (templates ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category as TemplateDef["category"],
        template: t.template,
        engine: t.engine as "google" | "maps",
        sources: t.sources,
      })),
    [templates]
  );

  const searches = React.useMemo(
    () => generateSearches(engineDefs, filters),
    [engineDefs, filters]
  );

  const favoriteIds = React.useMemo(
    () => new Set((templates ?? []).filter((t) => t.isFavorite).map((t) => t.id)),
    [templates]
  );

  const customPreview = React.useMemo(() => {
    const raw = customTemplate.trim();
    if (!raw) return null;
    const query =
      customEngine === "maps" ? buildMapsQuery(raw, filters) : buildGoogleQuery(raw, filters);
    return {
      query,
      url: customEngine === "maps" ? buildMapsUrl(query) : buildGoogleUrl(query, filters.dateRange),
      usable: isUsableQuery(query),
    };
  }, [customTemplate, customEngine, filters]);

  /* ---------------- actions ---------------- */

  const patch = (p: Partial<QueryFilters>) => setFilters((f) => ({ ...f, ...p }));
  const reset = () => setFilters({ ...EMPTY_FILTERS, country: filters.country });

  const logSearch = React.useCallback(
    async (payload: {
      query: string;
      engine: "google" | "maps";
      templateId?: string;
      templateName?: string;
      category?: string;
      label?: string;
    }) => {
      try {
        await apiSend("POST", "/api/searches", {
          ...payload,
          filters: { ...filters },
        });
        void loadRecent();
      } catch {
        /* logging must never block searching */
      }
    },
    [filters, loadRecent]
  );

  const runSearch = (search: GeneratedSearch) => {
    window.open(search.url, "_blank", "noopener,noreferrer");
    void logSearch({
      query: search.query,
      engine: search.engine,
      templateId: search.templateId,
      templateName: search.name,
      category: search.category,
      label: describeFilters(filters),
    });
  };

  const runCustom = () => {
    if (!customPreview || !customPreview.usable) return;
    window.open(customPreview.url, "_blank", "noopener,noreferrer");
    void logSearch({
      query: customPreview.query,
      engine: customEngine,
      templateName: "Custom template",
      category: "custom",
      label: describeFilters(filters),
    });
  };

  const openAll = () => {
    const batch = searches.slice(0, OPEN_ALL_LIMIT);
    if (batch.length === 0) return;
    batch.forEach((s) => window.open(s.url, "_blank", "noopener,noreferrer"));
    batch.forEach((s) =>
      void logSearch({
        query: s.query,
        engine: s.engine,
        templateId: s.templateId,
        templateName: s.name,
        category: s.category,
        label: describeFilters(filters),
      })
    );
    toast.info(
      `Opened ${batch.length} searches${
        searches.length > OPEN_ALL_LIMIT ? ` (first ${OPEN_ALL_LIMIT} of ${searches.length})` : ""
      } — allow pop-ups if some were blocked.`
    );
  };

  const copyQuery = async (query: string) => {
    const ok = await copyToClipboard(query);
    if (ok) {
      toast.success("Query copied");
    } else {
      toast.error("Could not copy");
    }
  };

  const copyAll = async () => {
    const text = searches.map((s) => `# ${s.name}\n${s.query}\n${s.url}`).join("\n\n");
    const ok = await copyToClipboard(text);
    if (ok) {
      toast.success(`Copied ${searches.length} queries`);
    } else {
      toast.error("Could not copy");
    }
  };

  const saveSearch = async () => {
    if (searches.length === 0) {
      toast.error("No queries to save — pick an industry or city first");
      return;
    }
    setSavingSearch(true);
    try {
      const res = await apiSend<{ count: number }>("POST", "/api/searches/save", {
        queries: searches.slice(0, 50).map((s) => s.query),
        engine: "google",
        label: describeFilters(filters) || "Untitled search",
        category: filters.category || null,
        filters: { ...filters },
      });
      toast.success(`Saved ${res.count} queries to search history`);
      void loadRecent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save search");
    } finally {
      setSavingSearch(false);
    }
  };

  const toggleFavorite = async (templateId: string) => {
    const tpl = templates?.find((t) => t.id === templateId);
    if (!tpl) return;
    const next = !tpl.isFavorite;
    setTemplates((list) =>
      (list ?? []).map((t) => (t.id === templateId ? { ...t, isFavorite: next } : t))
    );
    try {
      await apiSend("PUT", `/api/templates/${templateId}`, { isFavorite: next });
    } catch (e) {
      setTemplates((list) =>
        (list ?? []).map((t) => (t.id === templateId ? { ...t, isFavorite: tpl.isFavorite } : t))
      );
      toast.error(e instanceof Error ? e.message : "Could not update favorite");
    }
  };

  const deleteRecent = async (id: string) => {
    setRecent((r) => r.filter((x) => x.id !== id));
    try {
      await apiSend("DELETE", `/api/searches/${id}`);
    } catch {
      void loadRecent();
    }
  };

  const runRecent = (item: HistoryDto) => {
    const engine = item.engine === "maps" ? "maps" : "google";
    const url =
      engine === "maps" ? buildMapsUrl(item.query) : buildGoogleUrl(item.query);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /* ---------------- render ---------------- */

  const minFilters = hasMinimumFilters(filters);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      {/* LEFT — filters */}
      <div className="xl:sticky xl:top-20 xl:self-start">
        <FilterPanel
          filters={filters}
          onPatch={patch}
          onReset={reset}
          onSaveSearch={saveSearch}
          savingSearch={savingSearch}
        />
      </div>

      {/* RIGHT — generated searches */}
      <div className="min-w-0 space-y-5">
        {!minFilters && (
          <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted/40 px-4 py-3.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Pick an <strong className="font-medium text-foreground">industry</strong> and/or a{" "}
              <strong className="font-medium text-foreground">city</strong> on the left to generate
              targeted queries. Queries are formed live from Google search syntax — nothing is
              fetched or scraped by LeadFinder.
            </p>
          </div>
        )}

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">
              {templates === null ? "…" : searches.length}
            </span>
            <span className="text-xs text-muted-foreground">searches</span>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => setShowCustom((v) => !v)}
          >
            <Wand2 className="h-4 w-4" />
            {showCustom ? "Hide custom query" : "Custom query"}
          </Button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9"
              onClick={copyAll}
              disabled={searches.length === 0}
            >
              <Copy className="h-4 w-4" />
              Copy all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9"
              onClick={openAll}
              disabled={searches.length === 0}
            >
              <Rocket className="h-4 w-4" />
              Open all ({Math.min(searches.length, OPEN_ALL_LIMIT)})
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9"
              onClick={saveSearch}
              loading={savingSearch}
              disabled={searches.length === 0}
            >
              <Save className="h-4 w-4" />
              Save search
            </Button>
          </div>
        </div>

        {/* custom query builder */}
        {showCustom && (
          <Card className="border-primary/25 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wand2 className="h-4 w-4" />
                Custom query template
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Tabs
                value={customEngine}
                onValueChange={(v) => setCustomEngine(v as "google" | "maps")}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="google" className="text-xs">
                    Google
                  </TabsTrigger>
                  <TabsTrigger value="maps" className="text-xs">
                    Google Maps
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Textarea
                value={customTemplate}
                onChange={(e) => setCustomTemplate(e.target.value)}
                placeholder={
                  customEngine === "maps"
                    ? "{industry} in {city}, {state}, {country}"
                    : 'site:linkedin.com/in/ "{role}" "{city}" "{industry}"'
                }
                aria-label="Custom query template"
                className="font-mono text-xs"
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground">
                Placeholders: {"{industry} {city} {state} {country} {role} {keyword} {year}"} — saved
                templates can be added from the Templates page.
              </p>

              {customPreview && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Generated query</Label>
                  <div
                    className={cn(
                      "scrollbar-thin max-h-32 overflow-y-auto rounded-lg border bg-muted/50 p-2.5 font-mono text-[11.5px] break-all whitespace-pre-wrap",
                      !customPreview.usable && "opacity-60"
                    )}
                  >
                    {customPreview.query || "— empty —"}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => copyQuery(customPreview.query)}
                      disabled={!customPreview.usable}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={runCustom}
                      disabled={!customPreview.usable}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Search
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* disclaimer */}
        <div className="flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            These queries open Google results based on your filters. Indexed pages are{" "}
            <strong className="font-medium text-foreground/80">not verified leads</strong> — always
            confirm fit, ownership and contact details yourself before outreach.
          </p>
        </div>

        {/* cards */}
        {error && (
          <EmptyState
            icon={AlertTriangle}
            title="Could not load search templates"
            description={error}
            action={
              <Button type="button" size="sm" onClick={() => void loadAll()}>
                Retry
              </Button>
            }
          />
        )}

        {!error && templates === null && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4">
                <Skeleton className="mb-3 h-4 w-2/3" />
                <Skeleton className="mb-2 h-3 w-full" />
                <Skeleton className="mb-4 h-3 w-4/5" />
                <Skeleton className="mb-4 h-16 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-8 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!error && templates !== null && searches.length === 0 && (
          <EmptyState
            icon={Loader2}
            title="No queries match these filters"
            description="Add an industry or city, or widen the source/category selection to see generated searches."
            action={
              <Button type="button" size="sm" variant="outline" onClick={reset}>
                Reset filters
              </Button>
            }
          />
        )}

        {!error && searches.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {searches.map((s, i) => (
              <QueryCard
                key={s.templateId}
                search={s}
                index={i}
                favorite={favoriteIds.has(s.templateId)}
                onToggleFavorite={() => void toggleFavorite(s.templateId)}
                onSearch={() => runSearch(s)}
              />
            ))}
          </div>
        )}

        {/* recent searches */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-muted-foreground" />
                Recent searches
              </CardTitle>
              <Badge variant="muted">{recent.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {recent.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">
                Searches you run will appear here for quick reuse.
              </p>
            )}
            {recent.map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-2 rounded-lg border bg-background px-3 py-2 transition-colors hover:bg-accent/50"
              >
                <button
                  type="button"
                  onClick={() => runRecent(item)}
                  className="min-w-0 flex-1 text-left focus:outline-none"
                  title="Run again"
                >
                  <p className="truncate font-mono text-[11.5px] text-foreground/90">{item.query}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                    <span>{item.engine === "maps" ? "Maps" : "Google"}</span>
                    {item.label && <span>· {item.label}</span>}
                    {item.saved && <span>· saved</span>}
                    <span>· {timeAgo(item.createdAt)}</span>
                  </p>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete from history"
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => void deleteRecent(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
