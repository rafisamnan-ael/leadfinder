"use client";

import {
  AlertTriangle,
  Database,
  Download,
  Info,
  Save,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { apiGet, apiSend } from "@/lib/client";
import { getCities, INDUSTRIES } from "@/lib/geo";
import { COUNTRIES, DATE_RANGE_LABELS } from "@/lib/query-engine";
import { downloadText } from "@/lib/utils";
import { settingsSchema } from "@/lib/validations";

interface SettingsPayload {
  defaultCountry: string;
  defaultIndustry: string;
  defaultCity: string;
  pageSize: number;
  appendSizeKeywords: boolean;
  dateRange: string;
}

interface SettingsForm {
  defaultCountry: string;
  defaultIndustry: string;
  defaultCity: string;
  pageSize: string;
  appendSizeKeywords: boolean;
  dateRange: string;
}

const EMPTY_FORM: SettingsForm = {
  defaultCountry: "",
  defaultIndustry: "",
  defaultCity: "",
  pageSize: "20",
  appendSizeKeywords: false,
  dateRange: "",
};

const PAGE_SIZE_MIN = 10;
const PAGE_SIZE_MAX = 200;

const SIZE_KEYWORD_HINT =
  "Adds phrases like “11-50 employees” — approximate keyword only, not verified data.";

function toForm(settings: SettingsPayload): SettingsForm {
  return {
    defaultCountry: settings.defaultCountry ?? "",
    defaultIndustry: settings.defaultIndustry ?? "",
    defaultCity: settings.defaultCity ?? "",
    pageSize: String(settings.pageSize ?? 20),
    appendSizeKeywords: Boolean(settings.appendSizeKeywords),
    dateRange: settings.dateRange ?? "",
  };
}

export function SettingsView() {
  const [form, setForm] = React.useState<SettingsForm>(EMPTY_FORM);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [pageSizeError, setPageSizeError] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [clearOpen, setClearOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiGet<SettingsPayload>("/api/settings");
      setForm(toForm(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const cities = React.useMemo(() => getCities(form.defaultCountry), [form.defaultCountry]);

  const patch = (p: Partial<SettingsForm>) => setForm((f) => ({ ...f, ...p }));

  const save = async () => {
    const pageSize = Number.parseInt(form.pageSize, 10);
    if (!Number.isInteger(pageSize) || pageSize < PAGE_SIZE_MIN || pageSize > PAGE_SIZE_MAX) {
      setPageSizeError(
        `Results per page must be a whole number between ${PAGE_SIZE_MIN} and ${PAGE_SIZE_MAX}.`
      );
      return;
    }
    setPageSizeError(null);

    const parsed = settingsSchema.safeParse({
      defaultCountry: form.defaultCountry,
      defaultIndustry: form.defaultIndustry,
      defaultCity: form.defaultCity,
      pageSize,
      appendSizeKeywords: form.appendSizeKeywords,
      dateRange: form.dateRange,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid settings payload");
      return;
    }

    setSaving(true);
    try {
      const saved = await apiSend<SettingsPayload>("PUT", "/api/settings", parsed.data);
      setForm(toForm(saved));
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const exportLeads = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/leads/export");
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const text = await res.text();
      downloadText("leadfinder-leads.csv", text);
      toast.success("Leads exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export leads");
    } finally {
      setExporting(false);
    }
  };

  const clearHistory = async () => {
    setClearing(true);
    try {
      const res = await apiSend<{ count: number }>("DELETE", "/api/searches?scope=all");
      setClearOpen(false);
      toast.success(`Deleted ${res.count} search history entries`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear search history");
    } finally {
      setClearing(false);
    }
  };

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load settings"
        description={error}
        action={
          <Button type="button" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure LeadFinder defaults, review what the app does, and manage your data.
        </p>
      </div>

      {/* Search defaults */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-sm">Search defaults</CardTitle>
          <CardDescription>
            Applied automatically when you open Lead Search.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-country" className="text-xs font-medium text-muted-foreground">
                Default country
              </Label>
              <Select
                value={form.defaultCountry || "__none__"}
                onValueChange={(v) => patch({ defaultCountry: v === "__none__" ? "" : v })}
              >
                <SelectTrigger id="settings-country">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-industry" className="text-xs font-medium text-muted-foreground">
                Default industry
              </Label>
              <Combobox
                id="settings-industry"
                options={[...INDUSTRIES]}
                value={form.defaultIndustry}
                onChange={(v) => patch({ defaultIndustry: v })}
                allowCustom
                customPlaceholder="Type a custom industry…"
                placeholder="None"
                emptyText="No match — type a custom industry."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-city" className="text-xs font-medium text-muted-foreground">
                Default city
              </Label>
              <Combobox
                id="settings-city"
                options={cities}
                value={form.defaultCity}
                onChange={(v) => patch({ defaultCity: v })}
                allowCustom
                customPlaceholder="Type a custom city…"
                placeholder="None"
                emptyText="No suggestion — type a custom city."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-page-size" className="text-xs font-medium text-muted-foreground">
                Results per page
              </Label>
              <Input
                id="settings-page-size"
                type="number"
                inputMode="numeric"
                min={PAGE_SIZE_MIN}
                max={PAGE_SIZE_MAX}
                step={1}
                value={form.pageSize}
                aria-invalid={pageSizeError ? true : undefined}
                aria-describedby={pageSizeError ? "settings-page-size-error" : undefined}
                onChange={(e) => {
                  patch({ pageSize: e.target.value });
                  if (pageSizeError) setPageSizeError(null);
                }}
              />
              {pageSizeError && (
                <p id="settings-page-size-error" className="text-[11px] text-destructive">
                  {pageSizeError}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-date-range" className="text-xs font-medium text-muted-foreground">
              Default date filter
            </Label>
            <Select
              value={form.dateRange || "__none__"}
              onValueChange={(v) => patch({ dateRange: v === "__none__" ? "" : v })}
            >
              <SelectTrigger id="settings-date-range">
                <SelectValue placeholder="Any time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Any time</SelectItem>
                {(Object.keys(DATE_RANGE_LABELS) as (keyof typeof DATE_RANGE_LABELS)[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {DATE_RANGE_LABELS[key]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="settings-size-keywords" className="text-xs">
                Append size keywords
              </Label>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {SIZE_KEYWORD_HINT}
              </p>
            </div>
            <Switch
              id="settings-size-keywords"
              checked={form.appendSizeKeywords}
              onCheckedChange={(checked) => patch({ appendSizeKeywords: checked })}
            />
          </div>

          <Button type="button" onClick={() => void save()} loading={saving}>
            <Save className="h-4 w-4" />
            Save settings
          </Button>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-sm">About LeadFinder</CardTitle>
          <CardDescription>What this app does — and what it deliberately does not do.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Version
              </dt>
              <dd className="text-sm">1.0.0 (MVP)</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Stack
              </dt>
              <dd className="text-sm">Next.js · Prisma · SQLite</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cost
              </dt>
              <dd className="text-sm">No paid APIs required</dd>
            </div>
          </dl>
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 px-3 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-xs leading-relaxed text-muted-foreground">
              LeadFinder only builds Google search URLs and stores data you enter manually. It does
              not scrape Google or LinkedIn, bypass access restrictions, or automate outreach. Always
              verify prospects and contact people through permitted channels.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4 text-muted-foreground" />
            Data
          </CardTitle>
          <CardDescription>Export your leads or reset the search history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">Export leads</p>
              <p className="text-xs text-muted-foreground">
                Download every saved lead as a CSV file.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" loading={exporting} onClick={() => void exportLeads()}>
              <Download className="h-3.5 w-3.5" />
              Export leads
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">Clear search history</p>
              <p className="text-xs text-muted-foreground">
                Removes every saved and unsaved search history entry. Leads are not affected.
              </p>
            </div>
            <Dialog open={clearOpen} onOpenChange={setClearOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear search history
                </Button>
              </DialogTrigger>
              <DialogContent maxWidth="sm">
                <DialogHeader>
                  <DialogTitle>Clear all search history?</DialogTitle>
                  <DialogDescription>
                    This deletes ALL search history entries, including saved searches. The action
                    cannot be undone. Leads are not affected.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="button" variant="destructive" loading={clearing} onClick={() => void clearHistory()}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete all history
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
