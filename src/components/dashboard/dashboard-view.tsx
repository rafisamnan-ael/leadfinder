"use client";

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  FileSearch,
  Globe2,
  History,
  PieChart,
  Plus,
  Search,
  Star,
  Target,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiSend } from "@/lib/client";
import type { HistoryDto, TemplateDto } from "@/lib/mappers";
import { CATEGORY_LABELS, type CategoryId } from "@/lib/query-engine";
import { STATUS_BAR_COLOR, STATUS_ORDER, STATUS_VARIANT } from "@/lib/status";
import { cn, timeAgo } from "@/lib/utils";
import type { LeadStatus } from "@/lib/validations";

interface Stats {
  totalLeads: number;
  qualifiedLeads: number;
  contactedLeads: number;
  newLeads: number;
  wonLeads: number;
  byCountry: { name: string; count: number }[];
  byIndustry: { name: string; count: number }[];
  pipeline: { status: string; count: number }[];
  recentSearches: HistoryDto[];
  recentLeads: (Record<string, unknown> & {
    id: string;
    businessName: string;
    status: string;
    city: string | null;
    country: string | null;
    createdAt: string;
  })[];
  favoriteTemplates: TemplateDto[];
  totalTemplates: number;
  totalSearches: number;
  totalLists: number;
  lists: { id: string; name: string; leadCount: number }[];
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  tone = "default",
  href,
}: {
  title: string;
  value: number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "info" | "warning";
  href?: string;
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/12 text-success"
      : tone === "info"
        ? "bg-chart-3/15 text-chart-3"
        : tone === "warning"
          ? "bg-warning/15 text-warning"
          : "bg-muted text-muted-foreground";
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneClass)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {sub && <span className="pb-1 text-xs text-muted-foreground">{sub}</span>}
      </div>
    </>
  );
  const cls = "rounded-xl border bg-card p-5 shadow-sm transition-shadow";
  return href ? (
    <Link href={href} className={cn(cls, "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function BarList({
  title,
  icon: Icon,
  data,
  unit = "leads",
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data: { name: string; count: number }[];
  unit?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">No data yet.</p>
        )}
        {data.map((d) => (
          <div key={d.name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate font-medium">{d.name}</span>
              <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                {d.count}{" "}
                <span className="text-muted-foreground/60">
                  ({total > 0 ? Math.round((d.count / total) * 100) : 0}%)
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.max(4, (d.count / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
        <p className="pt-1 text-[11px] text-muted-foreground">
          {data.length} {unit} · total {total}
        </p>
      </CardContent>
    </Card>
  );
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

export function DashboardView() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      setStats(await apiGet<Stats>("/api/stats"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load statistics");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const toggleTemplateFavorite = async (t: TemplateDto) => {
    if (!stats) return;
    setStats((s) =>
      s ? { ...s, favoriteTemplates: s.favoriteTemplates.filter((x) => x.id !== t.id) } : s
    );
    try {
      await apiSend("PUT", `/api/templates/${t.id}`, { isFavorite: false });
    } catch {
      void load();
    }
  };

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load dashboard"
        description={error}
        action={
          <Button type="button" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const pipelineMax = Math.max(1, ...stats.pipeline.map((p) => p.count));
  const isEmpty = stats.totalLeads === 0 && stats.totalSearches === 0;

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Real counts from your LeadFinder database — nothing is estimated.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/leads">
              <UserPlus className="h-4 w-4" />
              Add lead
            </Link>
          </Button>
          <Button asChild size="sm" className="h-9">
            <Link href="/search">
              <Search className="h-4 w-4" />
              New search
            </Link>
          </Button>
        </div>
      </div>

      {isEmpty && (
        <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted/40 px-4 py-3.5">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Welcome to LeadFinder. Start by generating Google searches for your target
            industry/city, then save promising prospects into the CRM to build your pipeline.
          </p>
        </div>
      )}

      {/* stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total leads"
          value={stats.totalLeads}
          sub={`${stats.newLeads} new`}
          icon={Users}
          href="/leads"
        />
        <StatCard
          title="Qualified"
          value={stats.qualifiedLeads}
          sub="ready to approach"
          icon={Target}
          tone="success"
          href="/leads?status=Qualified"
        />
        <StatCard
          title="Contacted"
          value={stats.contactedLeads}
          sub="contacted + replied"
          icon={Globe2}
          tone="warning"
          href="/leads?status=Contacted"
        />
        <StatCard
          title="Won"
          value={stats.wonLeads}
          sub={`${stats.totalSearches} searches run`}
          icon={Trophy}
          tone="info"
          href="/leads?status=Won"
        />
      </div>

      {/* pipeline + geo + industry */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <PieChart className="h-4 w-4 text-muted-foreground" />
              Conversion pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {stats.pipeline.map((p) => {
              const status = p.status as LeadStatus;
              const known = (STATUS_ORDER as readonly string[]).includes(status);
              return (
                <div key={p.status} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <Badge variant={known ? STATUS_VARIANT[status] : "muted"}>{p.status}</Badge>
                    <span className="tabular-nums text-muted-foreground">
                      {p.count}{" "}
                      <span className="text-muted-foreground/60">
                        ({stats.totalLeads > 0 ? Math.round((p.count / stats.totalLeads) * 100) : 0}
                        %)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        known ? STATUS_BAR_COLOR[status] : "bg-primary"
                      )}
                      style={{ width: `${(p.count / pipelineMax) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <BarList title="Leads by country" icon={Globe2} data={stats.byCountry} />
        <BarList title="Top industries" icon={Building2} data={stats.byIndustry} />
      </div>

      {/* activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* recent searches */}
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <History className="h-4 w-4 text-muted-foreground" />
              Recent searches
            </CardTitle>
            <SectionLink href="/history">History</SectionLink>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.recentSearches.length === 0 && (
              <EmptyState
                icon={Search}
                title="No searches yet"
                description="Run your first Google search from Lead Search."
                className="border-0 py-6"
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href="/search">Open Lead Search</Link>
                  </Button>
                }
              />
            )}
            {stats.recentSearches.slice(0, 6).map((s) => (
              <Link
                key={s.id}
                href="/history"
                className="block rounded-lg border px-3 py-2 transition-colors hover:bg-accent/50"
              >
                <p className="truncate font-mono text-[11.5px]">{s.query}</p>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                  {s.engine === "maps" ? "Maps" : "Google"} · {timeAgo(s.createdAt)}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* recent leads */}
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4 text-muted-foreground" />
              Recently saved leads
            </CardTitle>
            <SectionLink href="/leads">All leads</SectionLink>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.recentLeads.length === 0 && (
              <EmptyState
                icon={UserPlus}
                title="No leads saved yet"
                description="Add a lead manually or from a search result."
                className="border-0 py-6"
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href="/leads">Add lead</Link>
                  </Button>
                }
              />
            )}
            {stats.recentLeads.slice(0, 6).map((lead) => (
              <Link
                key={lead.id}
                href="/leads"
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{lead.businessName}</p>
                  <p className="truncate text-[10.5px] text-muted-foreground">
                    {[lead.city, lead.country].filter(Boolean).join(", ") || "Location unknown"} ·{" "}
                    {timeAgo(lead.createdAt)}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[(lead.status as LeadStatus) ?? "New"] ?? "muted"}>
                  {lead.status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* favorite templates */}
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-muted-foreground" />
              Favorite templates
            </CardTitle>
            <SectionLink href="/templates">Templates</SectionLink>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.favoriteTemplates.length === 0 && (
              <EmptyState
                icon={FileSearch}
                title="No favorites yet"
                description={`Star templates to pin them here (${stats.totalTemplates} available).`}
                className="border-0 py-6"
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href="/templates">Browse templates</Link>
                  </Button>
                }
              />
            )}
            {stats.favoriteTemplates.slice(0, 6).map((t) => (
              <div
                key={t.id}
                className="group flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <Link href="/search" className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="truncate text-[10.5px] text-muted-foreground">
                    {CATEGORY_LABELS[t.category as CategoryId] ?? t.category}
                  </p>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove from favorites"
                  className="text-warning opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => void toggleTemplateFavorite(t)}
                >
                  <Star className="h-3.5 w-3.5 fill-current" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* lists strip */}
      {stats.lists.length > 0 && (
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              Saved lead lists
            </CardTitle>
            <SectionLink href="/leads">Manage</SectionLink>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {stats.lists.map((list) => (
              <Link key={list.id} href={`/leads?listId=${list.id}`}>
                <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs">
                  {list.name}
                  <span className="tabular-nums text-muted-foreground">{list.leadCount}</span>
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
