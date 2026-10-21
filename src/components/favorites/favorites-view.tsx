"use client";

import {
  AlertTriangle,
  ExternalLink,
  Search,
  Star,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, apiSend } from "@/lib/client";
import type { TemplateDto } from "@/lib/mappers";
import { CATEGORY_LABELS, type CategoryId } from "@/lib/query-engine";
import { STATUS_VARIANT } from "@/lib/status";
import { timeAgo } from "@/lib/utils";

interface LeadRow {
  id: string;
  businessName: string;
  website: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  status: string;
  createdAt: string;
  email: string | null;
}

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as CategoryId] ?? category;
}

function engineLabel(engine: string): string {
  return engine === "maps" ? "Google Maps" : "Google";
}

function websiteHref(url: string): string {
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
}

function locationOf(lead: LeadRow): string {
  return [lead.city, lead.state, lead.country].filter(Boolean).join(", ");
}

export function FavoritesView() {
  const [tab, setTab] = React.useState("templates");
  const [templates, setTemplates] = React.useState<TemplateDto[] | null>(null);
  const [leads, setLeads] = React.useState<LeadRow[] | null>(null);
  const [templatesError, setTemplatesError] = React.useState<string | null>(null);
  const [leadsError, setLeadsError] = React.useState<string | null>(null);

  const loadTemplates = React.useCallback(async () => {
    setTemplatesError(null);
    try {
      const data = await apiGet<{ items: TemplateDto[] }>("/api/templates?favorite=true");
      setTemplates(data.items);
    } catch (e) {
      setTemplatesError(e instanceof Error ? e.message : "Failed to load favorite templates");
    }
  }, []);

  const loadLeads = React.useCallback(async () => {
    setLeadsError(null);
    try {
      const data = await apiGet<{ items: LeadRow[] }>(
        "/api/leads?favorite=true&pageSize=100"
      );
      setLeads(data.items);
    } catch (e) {
      setLeadsError(e instanceof Error ? e.message : "Failed to load favorite leads");
    }
  }, []);

  React.useEffect(() => {
    void loadTemplates();
    void loadLeads();
  }, [loadTemplates, loadLeads]);

  const unfavoriteTemplate = async (template: TemplateDto) => {
    setTemplates((list) => (list ?? []).filter((t) => t.id !== template.id));
    try {
      await apiSend("PUT", `/api/templates/${template.id}`, { isFavorite: false });
      toast.success("Removed from favorites");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update favorite");
      void loadTemplates();
    }
  };

  const unfavoriteLead = async (lead: LeadRow) => {
    setLeads((list) => (list ?? []).filter((l) => l.id !== lead.id));
    try {
      await apiSend("PUT", `/api/leads/${lead.id}`, { favorite: false });
      toast.success("Removed from favorites");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update favorite");
      void loadLeads();
    }
  };

  const renderTemplates = () => {
    if (templatesError) {
      return (
        <EmptyState
          icon={AlertTriangle}
          title="Could not load favorite templates"
          description={templatesError}
          action={
            <Button type="button" size="sm" onClick={() => void loadTemplates()}>
              Retry
            </Button>
          }
        />
      );
    }

    if (templates === null) {
      return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="shadow-none">
              <CardHeader className="pb-3">
                <Skeleton className="mb-2 h-4 w-2/3" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (templates.length === 0) {
      return (
        <EmptyState
          icon={Star}
          title="No favorite templates"
          description="Star templates on the Search Templates page to pin them here."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/templates">Browse templates</Link>
            </Button>
          }
        />
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="flex flex-col shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="truncate text-sm">{template.name}</CardTitle>
                  {template.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {template.description}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${template.name} from favorites`}
                  className="shrink-0 text-warning"
                  onClick={() => void unfavoriteTemplate(template)}
                >
                  <Star className="h-4 w-4 fill-current" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant="muted" className="max-w-full truncate">
                  {categoryLabel(template.category)}
                </Badge>
                <Badge variant="outline">{engineLabel(template.engine)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <pre className="scrollbar-thin max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-lg border bg-muted/50 p-2.5 font-mono text-[11.5px] text-foreground/90">
                {template.template}
              </pre>
              <div className="mt-auto">
                <Button asChild variant="outline" size="sm">
                  <Link href="/search">
                    <Search className="h-3.5 w-3.5" />
                    Use in search
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderLeads = () => {
    if (leadsError) {
      return (
        <EmptyState
          icon={AlertTriangle}
          title="Could not load favorite leads"
          description={leadsError}
          action={
            <Button type="button" size="sm" onClick={() => void loadLeads()}>
              Retry
            </Button>
          }
        />
      );
    }

    if (leads === null) {
      return (
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/6" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      );
    }

    if (leads.length === 0) {
      return (
        <EmptyState
          icon={Star}
          title="No favorite leads"
          description="Star the leads you want to keep close — they will show up here for quick access."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/search">Find prospects</Link>
            </Button>
          }
        />
      );
    }

    return (
      <Card className="shadow-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <p className="font-medium">{lead.businessName}</p>
                    {lead.website && (
                      <a
                        href={websiteHref(lead.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-[16rem] items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground"
                      >
                        <span className="truncate">{lead.website}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                      </a>
                    )}
                    {lead.email && (
                      <p className="truncate text-[11px] text-muted-foreground/80">
                        {lead.email}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.industry || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {locationOf(lead) || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[lead.status as keyof typeof STATUS_VARIANT] ?? "muted"}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {timeAgo(lead.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${lead.businessName} from favorites`}
                        className="text-warning"
                        onClick={() => void unfavoriteLead(lead)}
                      >
                        <Star className="h-3.5 w-3.5 fill-current" />
                      </Button>
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link href="/leads" aria-label="Open CRM">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Favorites</h2>
        <p className="text-sm text-muted-foreground">
          Starred templates and leads, pinned in one place for quick access.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="templates">Templates ({templates?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="leads">Leads ({leads?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="templates">{renderTemplates()}</TabsContent>
        <TabsContent value="leads">{renderLeads()}</TabsContent>
      </Tabs>
    </div>
  );
}
