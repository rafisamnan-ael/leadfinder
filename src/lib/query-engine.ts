/**
 * LeadFinder search query engine.
 *
 * Pure, dependency-free functions that turn filter selections into
 * properly formed Google / Google Maps search queries and URLs.
 * Used by both the UI (live preview) and the API layer, and covered
 * by unit tests in src/__tests__/query-engine.test.ts.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export const COUNTRIES = ["Australia", "USA"] as const;
export type Country = (typeof COUNTRIES)[number];

export const ROLES = [
  "Owner",
  "Founder",
  "Co-Founder",
  "CEO",
  "Managing Director",
  "President",
  "Business Owner",
] as const;
export const ROLE_ALL = "All";

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "200+"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export type DateRange = "" | "day" | "week" | "month" | "year";

export const DATE_RANGE_LABELS: Record<Exclude<DateRange, "">, string> = {
  day: "Past 24 hours",
  week: "Past week",
  month: "Past month",
  year: "Past year",
};

export type SearchEngine = "google" | "maps";

export type SourceId =
  | "google"
  | "google-maps"
  | "linkedin-profiles"
  | "company-websites"
  | "buying-intent"
  | "startup-founders";

export const SEARCH_SOURCES: { id: SourceId; label: string; icon: string }[] = [
  { id: "google", label: "Google", icon: "search" },
  { id: "google-maps", label: "Google Maps", icon: "map" },
  { id: "linkedin-profiles", label: "LinkedIn Profiles", icon: "linkedin" },
  { id: "company-websites", label: "Company Websites", icon: "globe" },
  { id: "buying-intent", label: "Buying Intent", icon: "intent" },
  { id: "startup-founders", label: "Startup Founders", icon: "rocket" },
];

export type CategoryId =
  | "linkedin-profiles"
  | "company-websites"
  | "buying-intent"
  | "linkedin-posts"
  | "startup-founders"
  | "website-opportunities"
  | "communities"
  | "google-maps"
  | "contact-pages"
  | "custom";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  "linkedin-profiles": "A · LinkedIn Founder/Owner Profiles",
  "company-websites": "B · Business Owners via Websites",
  "buying-intent": "C · SEO & Web Buying Intent",
  "linkedin-posts": "D · LinkedIn Posts (via Google)",
  "startup-founders": "E · Startup Founders",
  "website-opportunities": "F · Website/SEO Opportunities",
  "communities": "G · Online Communities",
  "google-maps": "H · Google Maps Discovery",
  "contact-pages": "I · Public Contact Pages",
  custom: "Custom",
};

export interface QueryFilters {
  country: string;
  state: string;
  city: string;
  industry: string;
  roles: string[];
  companySize: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  dateRange: DateRange;
  appendSizeKeywords: boolean;
  sources: SourceId[];
  category: CategoryId | "";
}

export const EMPTY_FILTERS: QueryFilters = {
  country: "",
  state: "",
  city: "",
  industry: "",
  roles: [],
  companySize: "",
  includeKeywords: [],
  excludeKeywords: [],
  dateRange: "",
  appendSizeKeywords: false,
  sources: [],
  category: "",
};

export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  category: CategoryId;
  template: string;
  engine: SearchEngine;
  sources: SourceId[];
}

export interface GeneratedSearch {
  templateId: string;
  name: string;
  description: string;
  category: CategoryId;
  engine: SearchEngine;
  sources: SourceId[];
  query: string;
  url: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Strip characters that would break query structure. */
export function sanitizeTerm(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/["“”„]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve selected roles; "All" or empty selection expands to every title. */
export function resolveRoles(roles: string[] | undefined): string[] {
  const cleaned = (roles ?? []).map((r) => sanitizeTerm(r)).filter(Boolean);
  if (cleaned.length === 0 || cleaned.includes(ROLE_ALL)) return [...ROLES];
  return Array.from(new Set(cleaned));
}

function quotedList(values: string[], parenthesizeWhenMulti: boolean): string {
  if (values.length === 0) return "";
  if (values.length === 1) return `"${values[0]}"`;
  const joined = values.map((v) => `"${v}"`).join(" OR ");
  return parenthesizeWhenMulti ? `(${joined})` : joined;
}

const SIZE_KEYWORDS: Record<CompanySize, string> = {
  "1-10": '("1-10 employees" OR "small business")',
  "11-50": '"11-50 employees"',
  "51-200": '"51-200 employees"',
  "200+": '("200+ employees" OR "enterprise")',
};

function simpleValue(key: string, f: QueryFilters, year: number): string {
  switch (key) {
    case "country":
      return sanitizeTerm(f.country);
    case "state":
      return sanitizeTerm(f.state);
    case "city":
      return sanitizeTerm(f.city);
    case "industry":
      return sanitizeTerm(f.industry);
    case "keyword":
      return sanitizeTerm(f.includeKeywords[0] ?? "");
    case "year":
      return String(year);
    case "role":
      return resolveRoles(f.roles)[0] ?? "";
    default:
      return "";
  }
}

/**
 * Replace `{var}` and `"{var}"` placeholders. Quoted placeholders whose
 * value is empty are removed entirely; multi-value placeholders expand to
 * Google OR-groups. Nothing is left as a dangling `""`.
 */
function substitute(template: string, f: QueryFilters): string {
  const year = new Date().getFullYear();
  const multi: Record<string, string> = {
    role: quotedList(resolveRoles(f.roles), true),
    keyword: quotedList(
      Array.from(new Set(f.includeKeywords.map(sanitizeTerm).filter(Boolean))),
      true
    ),
  };

  let out = template;

  for (const [key, group] of Object.entries(multi)) {
    out = out.replace(new RegExp(`"\\{${key}\\}"`, "g"), group);
    out = out.replace(new RegExp(`\\{${key}\\}`, "g"), group);
  }

  const simples = ["country", "state", "city", "industry", "year"];
  for (const key of simples) {
    const value = simpleValue(key, f, year);
    out = out.replace(new RegExp(`"\\{${key}\\}"`, "g"), value ? `"${value}"` : "");
    out = out.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }

  return out;
}

/**
 * Clean up a substituted query: no empty quotes, no dangling OR/AND,
 * no doubled operators, no stray commas, single-spaced.
 */
export function sanitizeQuery(input: string): string {
  let s = input.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

  const pass = () => {
    s = s.replace(/\s+/g, " ");
    s = s.replace(/(?:^|[\s(])""(?=[\s)]|$)/g, " ");
    s = s.replace(/\(\s*\)/g, " ");
    s = s.replace(/\bOR\s+(?:OR\b)/gi, "OR ");
    s = s.replace(/\bAND\s+(?:AND\b)/gi, "AND ");
    s = s.replace(/(?:^|\()\s*(?:OR|AND)\b/gi, " ");
    s = s.replace(/\b(?:OR|AND)\s*(?:[)]|$)/gi, " ");
    s = s.replace(/\s*,\s*,+/g, ",");
    s = s.replace(/^[,\s]+/, "");
    s = s.replace(/[,\s]+$/, "");
    s = s.replace(/\s+/g, " ");
    s = s.trim();
  };

  pass();
  pass();
  return s;
}

/** True when a generated query is worth sending to Google. */
export function isUsableQuery(query: string): boolean {
  if (query.length < 3) return false;
  const stripped = query.replace(/[()"-\s]/g, "");
  return stripped.length >= 3;
}

export function buildGoogleUrl(query: string, dateRange?: DateRange): string {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`;
  const unit: Record<Exclude<DateRange, "">, string> = {
    day: "d",
    week: "w",
    month: "m",
    year: "y",
  };
  if (dateRange && unit[dateRange]) {
    return `${url}&tbs=qdr:${unit[dateRange]}`;
  }
  return url;
}

export function buildMapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`;
}

/* ------------------------------------------------------------------ */
/* Query builders                                                      */
/* ------------------------------------------------------------------ */

/**
 * Build a Google web-search query from a raw template + filters.
 * Supports: {industry} {city} {state} {country} {role} {keyword} {year}
 * plus include/exclude keyword and optional company-size keyword appends.
 */
export function buildGoogleQuery(template: string, f: QueryFilters): string {
  let out = substitute(template, f);

  const hasKeywordPlaceholder = template.includes("{keyword}");
  const includes = Array.from(
    new Set(f.includeKeywords.map(sanitizeTerm).filter(Boolean))
  );
  if (!hasKeywordPlaceholder && includes.length > 0) {
    out += ` ${quotedList(includes, true)}`;
  }

  const excludes = Array.from(
    new Set(f.excludeKeywords.map(sanitizeTerm).filter(Boolean))
  );
  for (const kw of excludes) {
    out += ` -"${kw}"`;
  }

  if (f.appendSizeKeywords && f.companySize) {
    out += ` ${SIZE_KEYWORDS[f.companySize as CompanySize] ?? ""}`;
  }

  return sanitizeQuery(out);
}

/**
 * Build a Google Maps query from a phrase pattern.
 * Supports: {industry} {city} {state} {country}
 */
export function buildMapsQuery(pattern: string, f: QueryFilters): string {
  let s = pattern;

  // Substitute {state} and {country} specifically to fix Maps queries
  s = s.replace(/\{state\}/g, sanitizeTerm(f.state));
  s = s.replace(/\{country\}/g, sanitizeTerm(f.country));

  // Drop placeholders and prepositions tied to them when empty
  const dropIfEmpty = (key: string, value: string) => {
    if (value) return;
    s = s.replace(new RegExp(`\\{${key}\\}`, "g"), "");
  };
  dropIfEmpty("industry", sanitizeTerm(f.industry));
  dropIfEmpty("city", sanitizeTerm(f.city));

  s = substitute(s, f);
  s = s
    .split(/[,|]/) // Handle commas or pipes as separators
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 0)
    .map((seg) => seg.replace(/^\s*(?:in|near|at)\s+/i, ""))
    .map((seg) => seg.replace(/\s+(?:in|near|at)$/i, ""))
    .filter((seg) => seg.length > 0 && !/^(?:in|near|at)$/i.test(seg))
    .join(", ");

  return sanitizeQuery(s);
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

export interface GenerateOptions {
  category?: CategoryId | "";
  sources?: SourceId[];
}

/** Generate the final list of runnable searches for the given filters. */
export function generateSearches(
  templates: TemplateDef[],
  filters: QueryFilters,
  options: GenerateOptions = {}
): GeneratedSearch[] {
  const category = options.category ?? filters.category ?? "";
  const selectedSources =
    options.sources !== undefined ? options.sources : filters.sources ?? [];
  const results: GeneratedSearch[] = [];

  for (const tpl of templates) {
    if (category && tpl.category !== category) continue;
    if (
      selectedSources.length > 0 &&
      !tpl.sources.some((s) => selectedSources.includes(s))
    ) {
      continue;
    }

    const query =
      tpl.engine === "maps"
        ? buildMapsQuery(tpl.template, filters)
        : buildGoogleQuery(tpl.template, filters);

    if (!isUsableQuery(query)) continue;

    results.push({
      templateId: tpl.id,
      name: tpl.name,
      description: tpl.description,
      category: tpl.category,
      engine: tpl.engine,
      sources: tpl.sources,
      query,
      url:
        tpl.engine === "maps"
          ? buildMapsUrl(query)
          : buildGoogleUrl(query, filters.dateRange),
    });
  }

  return results;
}

/** Short human label for a filter snapshot (used in search history). */
export function describeFilters(f: QueryFilters): string {
  const parts: string[] = [];
  if (f.industry) parts.push(f.industry);
  const place = [f.city, f.state, f.country].filter(Boolean).join(", ");
  if (place) parts.push(place);
  const roles = resolveRoles(f.roles);
  if (roles.length !== ROLES.length) parts.push(roles.join("/"));
  if (f.companySize) parts.push(`${f.companySize} staff`);
  if (f.dateRange) parts.push(DATE_RANGE_LABELS[f.dateRange]);
  return parts.join(" · ");
}

/** Empty-ness check used to disable actions until filters are chosen. */
export function hasMinimumFilters(f: QueryFilters): boolean {
  return Boolean(sanitizeTerm(f.industry) || sanitizeTerm(f.city));
}
