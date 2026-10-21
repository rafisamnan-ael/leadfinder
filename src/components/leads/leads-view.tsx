"use client";

import {
  AlertTriangle,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Globe,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ImportDialog } from "@/components/leads/import-dialog";
import { LeadFormDialog, type Lead } from "@/components/leads/lead-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, apiSend, buildLeadQuery } from "@/lib/client";
import { COUNTRIES, INDUSTRIES } from "@/lib/geo";
import { isLeadStatus, STATUS_ORDER, STATUS_VARIANT } from "@/lib/status";
import { cn, downloadText, splitTags, timeAgo } from "@/lib/utils";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/validations";

const ALL = "__all__";
const NONE = "__any__";
const PAGE_SIZE = 20;

type SortField = "businessName" | "status" | "createdAt" | "country" | "industry";
interface ListItem {
  id: string;
  name: string;
  createdAt?: string;
  leadCount?: number;
}

interface LeadsResponse {
  items: Lead[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

type DeleteRequest =
  | { kind: "single"; id: string; name: string }
  | { kind: "bulk"; count: number };

function statusVariant(status: string) {
  return isLeadStatus(status) ? STATUS_VARIANT[status] : "muted";
}

function websiteHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "#";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function SortableHead({
  field,
  label,
  sort,
  order,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  sort: SortField;
  order: "asc" | "desc";
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const active = sort === field;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        aria-label={`Sort by ${label}`}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {active ? (
          order === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}

export function LeadsView() {
  const searchParams = useSearchParams();

  /* ---------------- filters ---------------- */

  // `status` and `listId` are pre-filled from the URL once, on mount.
  const [queryText, setQueryText] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [status, setStatus] = React.useState(() => {
    const next = searchParams.get("status");
    return next && (LEAD_STATUSES as readonly string[]).includes(next) ? next : "";
  });
  const [country, setCountry] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [favoriteOnly, setFavoriteOnly] = React.useState(false);
  const [listId, setListId] = React.useState(() => searchParams.get("listId") ?? "");
  const [sort, setSort] = React.useState<SortField>("createdAt");
  const [order, setOrder] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);

  /* ---------------- data ---------------- */

  const [items, setItems] = React.useState<Lead[]>([]);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lists, setLists] = React.useState<ListItem[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  /* ---------------- dialogs ---------------- */

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Lead | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [listDialogOpen, setListDialogOpen] = React.useState(false);
  const [newListName, setNewListName] = React.useState("");
  const [creatingList, setCreatingList] = React.useState(false);
  const [deleteRequest, setDeleteRequest] = React.useState<DeleteRequest | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [bulkStatus, setBulkStatus] = React.useState(NONE);

  /* ---------------- debounce the search box ---------------- */

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(queryText), 300);
    return () => clearTimeout(timer);
  }, [queryText]);

  /* ---------------- fetch ---------------- */

  const queryString = React.useMemo(
    () =>
      buildLeadQuery({
        q: debouncedQuery,
        status,
        country,
        industry,
        favorite: favoriteOnly ? true : undefined,
        listId,
        sort,
        order,
        page,
        pageSize: PAGE_SIZE,
      }),
    [debouncedQuery, status, country, industry, favoriteOnly, listId, sort, order, page]
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<LeadsResponse>(`/api/leads${queryString}`);
      setItems(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) {
      setItems([]);
      setTotal(0);
      setPages(1);
      setError(e instanceof Error ? e.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const loadLists = React.useCallback(async () => {
    try {
      const data = await apiGet<{ items: ListItem[] }>("/api/lists");
      setLists(data.items);
    } catch {
      setLists([]);
    }
  }, []);

  React.useEffect(() => {
    void loadLists();
  }, [loadLists]);

  /* ---------------- selection ---------------- */

  const clearSelection = React.useCallback(() => setSelected(new Set()), []);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageIds = React.useMemo(() => items.map((lead) => lead.id), [items]);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  /* ---------------- filter helpers ---------------- */

  const applyFilter = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setQueryText("");
    setDebouncedQuery("");
    setStatus("");
    setCountry("");
    setIndustry("");
    setFavoriteOnly(false);
    setListId("");
    setPage(1);
  };

  const hasFilters = Boolean(
    queryText || status || country || industry || favoriteOnly || listId
  );

  const toggleSort = (field: SortField) => {
    if (sort === field) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder(field === "createdAt" ? "desc" : "asc");
    }
    setPage(1);
  };

  /* ---------------- mutations ---------------- */

  const changeStatus = async (lead: Lead, next: LeadStatus) => {
    try {
      await apiSend("PUT", `/api/leads/${lead.id}`, { status: next });
      toast.success(`${lead.businessName} → ${next}`);
      clearSelection();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    }
  };

  const toggleFavorite = async (lead: Lead) => {
    try {
      await apiSend("PUT", `/api/leads/${lead.id}`, { favorite: !lead.favorite });
      clearSelection();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update favorite");
    }
  };

  const bulkSetStatus = async (next: LeadStatus) => {
    try {
      const res = await apiSend<{ count: number }>("PATCH", "/api/leads/bulk", {
        ids: Array.from(selected),
        action: "setStatus",
        status: next,
      });
      toast.success(`Updated ${res.count} lead${res.count === 1 ? "" : "s"}`);
      clearSelection();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    }
  };

  const bulkAddToList = async (targetListId: string) => {
    const list = lists.find((l) => l.id === targetListId);
    try {
      const res = await apiSend<{ count: number }>("PATCH", "/api/leads/bulk", {
        ids: Array.from(selected),
        action: "addToList",
        listId: targetListId,
      });
      toast.success(
        `Added ${res.count} lead${res.count === 1 ? "" : "s"} to ${list?.name ?? "list"}`
      );
      clearSelection();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add leads to list");
    }
  };

  const confirmDelete = async () => {
    if (!deleteRequest) return;
    setDeleting(true);
    try {
      if (deleteRequest.kind === "single") {
        await apiSend("DELETE", `/api/leads/${deleteRequest.id}`);
        toast.success(`Deleted ${deleteRequest.name}`);
      } else {
        const res = await apiSend<{ count: number }>("PATCH", "/api/leads/bulk", {
          ids: Array.from(selected),
          action: "delete",
        });
        toast.success(`Deleted ${res.count} lead${res.count === 1 ? "" : "s"}`);
      }
      clearSelection();
      setDeleteRequest(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete lead");
    } finally {
      setDeleting(false);
    }
  };

  const createList = async () => {
    const name = newListName.trim();
    if (!name) return;
    setCreatingList(true);
    try {
      const list = await apiSend<ListItem>("POST", "/api/lists", { name });
      toast.success(`List “${list.name}” created`);
      setNewListName("");
      setListDialogOpen(false);
      await loadLists();
      setListId(list.id);
      setPage(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create list");
    } finally {
      setCreatingList(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const qs = buildLeadQuery({
        q: debouncedQuery,
        status,
        country,
        industry,
        favorite: favoriteOnly ? true : undefined,
        listId,
      });
      const res = await fetch(`/api/leads/export${qs}`, {
        headers: { Accept: "text/csv" },
      });
      if (!res.ok) throw new Error("Export failed");
      const text = await res.text();
      downloadText("leadfinder-leads.csv", text);
      toast.success("CSV exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export CSV");
    } finally {
      setExporting(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditing(lead);
    setFormOpen(true);
  };

  const handleSaved = () => {
    clearSelection();
    void load();
  };

  const handleImported = () => {
    clearSelection();
    void load();
    void loadLists();
  };

  /* ---------------- derived ---------------- */

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const selectedCount = selected.size;

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search leads…"
            aria-label="Search leads"
            className="h-9 w-full pl-8 sm:w-64"
          />
        </div>

        <Select
          value={status || ALL}
          onValueChange={(v) => applyFilter(setStatus, v === ALL ? "" : v)}
        >
          <SelectTrigger className="h-9 w-[148px]" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={country || ALL}
          onValueChange={(v) => applyFilter(setCountry, v === ALL ? "" : v)}
        >
          <SelectTrigger className="h-9 w-[148px]" aria-label="Filter by country">
            <SelectValue placeholder="All countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All countries</SelectItem>
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={industry || ALL}
          onValueChange={(v) => applyFilter(setIndustry, v === ALL ? "" : v)}
        >
          <SelectTrigger className="h-9 w-[148px]" aria-label="Filter by industry">
            <SelectValue placeholder="All industries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All industries</SelectItem>
            {INDUSTRIES.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          variant={favoriteOnly ? "default" : "outline"}
          className="h-9"
          aria-pressed={favoriteOnly}
          onClick={() => applyFilter(setFavoriteOnly, !favoriteOnly)}
        >
          <Star className={cn("h-4 w-4", favoriteOnly && "fill-current")} />
          Favorites only
        </Button>

        <Select
          value={listId || ALL}
          onValueChange={(v) => applyFilter(setListId, v === ALL ? "" : v)}
        >
          <SelectTrigger className="h-9 w-[148px]" aria-label="Filter by list">
            <SelectValue placeholder="All lists" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All lists</SelectItem>
            {lists.map((list) => (
              <SelectItem key={list.id} value={list.id}>
                {list.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          onClick={() => setListDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New list
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="h-4 w-4" />
          Import
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          loading={exporting}
          onClick={() => void exportCsv()}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>

        <Button
          type="button"
          size="sm"
          className="h-9"
          onClick={openCreate}
        >
          <UserPlus className="h-4 w-4" />
          New Lead
        </Button>
      </div>

      {/* bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">
            {selectedCount} selected
          </span>

          <Select
            value={bulkStatus}
            onValueChange={(v) => {
              setBulkStatus(NONE);
              if (v !== NONE) void bulkSetStatus(v as LeadStatus);
            }}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="Set status">
              <SelectValue placeholder="Set status…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Set status…</SelectItem>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="h-8">
                Add to list
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Add to list</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {lists.length === 0 ? (
                <DropdownMenuItem disabled>No lists yet</DropdownMenuItem>
              ) : (
                lists.map((list) => (
                  <DropdownMenuItem
                    key={list.id}
                    onSelect={() => void bulkAddToList(list.id)}
                  >
                    {list.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-8"
            onClick={() => setDeleteRequest({ kind: "bulk", count: selectedCount })}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={clearSelection}
          >
            Clear
          </Button>
        </div>
      )}

      {/* table */}
      <Card className="shadow-none">
        <CardContent className="p-0">
          {error ? (
            <div className="p-5">
              <EmptyState
                icon={AlertTriangle}
                title="Could not load leads"
                description={error}
                action={
                  <Button type="button" size="sm" onClick={() => void load()}>
                    Retry
                  </Button>
                }
              />
            </div>
          ) : loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-5">
              {hasFilters ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="No leads match these filters"
                  description="Try a different search term, or widen the status, country and industry filters."
                  action={
                    <Button type="button" size="sm" variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={UserPlus}
                  title="Add your first lead"
                  description="Save a prospect from Lead Search, or add one manually to start building your pipeline."
                  action={
                    <Button type="button" size="sm" onClick={openCreate}>
                      New Lead
                    </Button>
                  }
                />
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all leads on this page"
                    />
                  </TableHead>
                  <SortableHead
                    field="businessName"
                    label="Business"
                    sort={sort}
                    order={order}
                    onSort={toggleSort}
                    className="min-w-[220px]"
                  />
                  <TableHead className="min-w-[160px]">Founder / Owner</TableHead>
                  <SortableHead
                    field="industry"
                    label="Industry"
                    sort={sort}
                    order={order}
                    onSort={toggleSort}
                    className="min-w-[120px]"
                  />
                  <TableHead className="min-w-[160px]">Location</TableHead>
                  <SortableHead
                    field="status"
                    label="Status"
                    sort={sort}
                    order={order}
                    onSort={toggleSort}
                    className="min-w-[130px]"
                  />
                  <TableHead className="min-w-[150px]">Tags</TableHead>
                  <SortableHead
                    field="createdAt"
                    label="Added"
                    sort={sort}
                    order={order}
                    onSort={toggleSort}
                    className="min-w-[100px]"
                  />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((lead) => {
                  const tags = splitTags(lead.tags);
                  return (
                    <TableRow
                      key={lead.id}
                      data-state={selected.has(lead.id) ? "selected" : undefined}
                    >
                      <TableCell className="py-2">
                        <Checkbox
                          checked={selected.has(lead.id)}
                          onCheckedChange={() => toggleSelected(lead.id)}
                          aria-label={`Select ${lead.businessName}`}
                        />
                      </TableCell>

                      <TableCell className="py-2">
                        <p className="font-medium">{lead.businessName}</p>
                        {lead.website && (
                          <a
                            href={websiteHref(lead.website)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex max-w-[220px] items-center gap-1 text-[11px] text-muted-foreground hover:text-primary hover:underline"
                          >
                            <Globe className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{lead.website}</span>
                          </a>
                        )}
                      </TableCell>

                      <TableCell className="py-2">
                        {lead.founderName ? (
                          <>
                            <p className="text-sm">{lead.founderName}</p>
                            {lead.jobTitle && (
                              <p className="text-[11px] text-muted-foreground">
                                {lead.jobTitle}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="py-2">
                        {lead.industry ? (
                          <span className="text-sm">{lead.industry}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="py-2">
                        <span className="text-sm">
                          {[lead.city, lead.state, lead.country].filter(Boolean).join(", ") ||
                            "—"}
                        </span>
                      </TableCell>

                      <TableCell className="py-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Change status of ${lead.businessName}`}
                            >
                              <Badge variant={statusVariant(lead.status)}>
                                {lead.status}
                              </Badge>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuLabel>Set status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {STATUS_ORDER.map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onSelect={() => void changeStatus(lead, s)}
                              >
                                <Badge variant={STATUS_VARIANT[s]}>{s}</Badge>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>

                      <TableCell className="py-2">
                        {tags.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            {tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="muted">
                                {tag}
                              </Badge>
                            ))}
                            {tags.length > 3 && (
                              <Badge variant="outline">+{tags.length - 3}</Badge>
                            )}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-2">
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(lead.createdAt)}
                        </span>
                      </TableCell>

                      <TableCell className="py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={
                              lead.favorite
                                ? `Remove ${lead.businessName} from favorites`
                                : `Add ${lead.businessName} to favorites`
                            }
                            className={cn(
                              lead.favorite ? "text-warning" : "text-muted-foreground"
                            )}
                            onClick={() => void toggleFavorite(lead)}
                          >
                            <Star className={cn("h-3.5 w-3.5", lead.favorite && "fill-current")} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${lead.businessName}`}
                            onClick={() => openEdit(lead)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${lead.businessName}`}
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setDeleteRequest({
                                kind: "single",
                                id: lead.id,
                                name: lead.businessName,
                              })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* pagination */}
      {!error && !loading && items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Showing {from}–{to} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              Page {page} of {pages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* lead form */}
      <LeadFormDialog
        key={editing?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={editing}
        onSaved={handleSaved}
      />

      {/* import */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />

      {/* new list */}
      <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
        <DialogContent maxWidth="sm">
          <DialogHeader>
            <DialogTitle>New list</DialogTitle>
            <DialogDescription>
              Group related leads so you can filter and export them together.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="new-list-name">List name</Label>
            <Input
              id="new-list-name"
              className="mt-1.5"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Austin plumbing prospects"
              onKeyDown={(e) => {
                if (e.key === "Enter") void createList();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setListDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              loading={creatingList}
              disabled={!newListName.trim()}
              onClick={() => void createList()}
            >
              Create list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirmation */}
      <Dialog
        open={deleteRequest !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteRequest(null);
        }}
      >
        <DialogContent maxWidth="sm">
          <DialogHeader>
            <DialogTitle>Delete lead?</DialogTitle>
            <DialogDescription>
              {deleteRequest?.kind === "bulk"
                ? `This permanently deletes ${deleteRequest.count} selected lead${deleteRequest.count === 1 ? "" : "s"}.`
                : `“${deleteRequest?.name ?? ""}” will be permanently deleted. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteRequest(null)}>
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
