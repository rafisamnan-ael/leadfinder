"use client";

import { RotateCcw, Save } from "lucide-react";
import * as React from "react";

import { KeywordInput } from "@/components/search/keyword-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getCities, getStates, INDUSTRIES } from "@/lib/geo";
import {
  CATEGORY_LABELS,
  COUNTRIES,
  DATE_RANGE_LABELS,
  ROLES,
  SEARCH_SOURCES,
  type CategoryId,
  type QueryFilters,
} from "@/lib/query-engine";

const CATEGORY_OPTIONS: { value: CategoryId | ""; label: string }[] = [
  { value: "", label: "All categories" },
  ...(Object.entries(CATEGORY_LABELS) as [CategoryId, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

const SIZE_OPTIONS = ["", "1-10", "11-50", "51-200", "200+"] as const;

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

export function FilterPanel({
  filters,
  onPatch,
  onReset,
  onSaveSearch,
  savingSearch,
}: {
  filters: QueryFilters;
  onPatch: (patch: Partial<QueryFilters>) => void;
  onReset: () => void;
  onSaveSearch: () => void;
  savingSearch: boolean;
}) {
  const states = React.useMemo(() => getStates(filters.country), [filters.country]);
  const cities = React.useMemo(() => getCities(filters.country), [filters.country]);
  const rolesAllActive = filters.roles.length === 0 || filters.roles.includes("All");

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">Search filters</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={onReset} className="h-7 gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Country" htmlFor="f-country">
            <Select
              value={filters.country}
              onValueChange={(v) => onPatch({ country: v, state: "", city: "" })}
            >
              <SelectTrigger id="f-country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__" disabled>
                  Select country
                </SelectItem>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="State / Region" htmlFor="f-state">
            <Select
              value={filters.state || "__any__"}
              onValueChange={(v) => onPatch({ state: v === "__any__" ? "" : v })}
              disabled={!filters.country}
            >
              <SelectTrigger id="f-state">
                <SelectValue placeholder={filters.country ? "Any state" : "Select country first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Any state</SelectItem>
                {states.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="City" hint="Pick a suggestion or type any custom city." htmlFor="f-city">
          <Combobox
            id="f-city"
            options={cities}
            value={filters.city}
            onChange={(v) => onPatch({ city: v })}
            allowCustom
            customPlaceholder="Type a custom city…"
            placeholder={filters.country ? "Search city…" : "Select country for suggestions"}
            emptyText="No suggestion — type a custom city."
          />
        </Field>

        <Field label="Industry" htmlFor="f-industry">
          <Combobox
            id="f-industry"
            options={[...INDUSTRIES]}
            value={filters.industry}
            onChange={(v) => onPatch({ industry: v })}
            allowCustom
            customPlaceholder="Type a custom industry…"
            placeholder="Select industry…"
            emptyText="No match — type a custom industry."
          />
        </Field>

        <Field
          label="Decision-maker"
          hint="Empty = all titles (Owner, Founder, CEO…)."
        >
          <MultiSelect
            options={[...ROLES]}
            value={filters.roles}
            onChange={(roles) => onPatch({ roles })}
            placeholder="All roles"
            allowAll
            allLabel="All roles"
            allActive={rolesAllActive}
            onAll={() => onPatch({ roles: [] })}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company size (optional)" htmlFor="f-size">
            <Select
              value={filters.companySize || "__any__"}
              onValueChange={(v) => onPatch({ companySize: v === "__any__" ? "" : v })}
            >
              <SelectTrigger id="f-size">
                <SelectValue placeholder="Any size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Any size</SelectItem>
                {SIZE_OPTIONS.filter(Boolean).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s} employees
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Date filter" hint="Applies to Google results." htmlFor="f-date">
            <Select
              value={filters.dateRange || "__any__"}
              onValueChange={(v) =>
                onPatch({ dateRange: (v === "__any__" ? "" : v) as QueryFilters["dateRange"] })
              }
            >
              <SelectTrigger id="f-date">
                <SelectValue placeholder="Any time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Any time</SelectItem>
                {(Object.keys(DATE_RANGE_LABELS) as (keyof typeof DATE_RANGE_LABELS)[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {DATE_RANGE_LABELS[key]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
          <div className="space-y-0.5">
            <Label htmlFor="f-sizekw" className="text-xs">
              Append size keywords
            </Label>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Adds phrases like “11-50 employees” — approximate keyword only, not verified data.
            </p>
          </div>
          <Switch
            id="f-sizekw"
            checked={filters.appendSizeKeywords && Boolean(filters.companySize)}
            disabled={!filters.companySize}
            onCheckedChange={(checked) => onPatch({ appendSizeKeywords: checked })}
          />
        </div>

        <Field label="Include keywords">
          <KeywordInput
            value={filters.includeKeywords}
            onChange={(includeKeywords) => onPatch({ includeKeywords })}
            placeholder="e.g. small business, family owned"
            ariaLabel="Include keywords"
          />
        </Field>

        <Field label="Exclude keywords" hint="Removed from every query as -“keyword”.">
          <KeywordInput
            value={filters.excludeKeywords}
            onChange={(excludeKeywords) => onPatch({ excludeKeywords })}
            placeholder="e.g. jobs, careers, Indeed"
            tone="exclude"
            ariaLabel="Exclude keywords"
          />
        </Field>

        <Field label="Search source" hint="Empty = all sources shown.">
          <MultiSelect
            options={SEARCH_SOURCES.map((s) => s.label)}
            value={SEARCH_SOURCES.filter((s) => filters.sources.includes(s.id)).map((s) => s.label)}
            onChange={(labels) =>
              onPatch({
                sources: SEARCH_SOURCES.filter((s) => labels.includes(s.label)).map((s) => s.id),
              })
            }
            placeholder="All sources"
          />
        </Field>

        <Field label="Search category" htmlFor="f-category">
          <Select
            value={filters.category || "__all__"}
            onValueChange={(v) => onPatch({ category: v === "__all__" ? "" : (v as CategoryId) })}
          >
            <SelectTrigger id="f-category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value || "all"} value={opt.value || "__all__"}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onSaveSearch}
          loading={savingSearch}
        >
          <Save className="h-4 w-4" />
          Save search
        </Button>
      </CardContent>
    </Card>
  );
}
