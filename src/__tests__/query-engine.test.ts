import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  ROLES,
  type QueryFilters,
  type TemplateDef,
  buildGoogleQuery,
  buildGoogleUrl,
  buildMapsQuery,
  buildMapsUrl,
  describeFilters,
  generateSearches,
  hasMinimumFilters,
  isUsableQuery,
  resolveRoles,
  sanitizeQuery,
  sanitizeTerm,
} from "@/lib/query-engine";

const filters = (overrides: Partial<QueryFilters> = {}): QueryFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

const ALL_ROLES_GROUP = `(${ROLES.map((r) => `"${r}"`).join(" OR ")})`;

describe("sanitizeTerm", () => {
  it("strips straight and smart quotes", () => {
    expect(sanitizeTerm('"Bakery"')).toBe("Bakery");
    expect(sanitizeTerm("\u201Ccafe\u201D")).toBe("cafe");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeTerm("  a   b  ")).toBe("a b");
  });

  it("handles null/undefined/empty", () => {
    expect(sanitizeTerm(null)).toBe("");
    expect(sanitizeTerm(undefined)).toBe("");
    expect(sanitizeTerm("   ")).toBe("");
  });
});

describe("resolveRoles", () => {
  it("empty selection expands to every role", () => {
    expect(resolveRoles([])).toEqual([...ROLES]);
  });

  it('"All" expands to every role', () => {
    expect(resolveRoles(["All"])).toEqual([...ROLES]);
  });

  it("keeps an explicit subset and dedupes", () => {
    expect(resolveRoles(["Owner", "Founder", "Owner"])).toEqual([
      "Owner",
      "Founder",
    ]);
  });

  it("sanitizes and drops empty entries", () => {
    expect(resolveRoles(["  Owner  ", "", "   "])).toEqual(["Owner"]);
    expect(resolveRoles(["", "   "])).toEqual([...ROLES]);
  });
});

describe("sanitizeQuery", () => {
  it("collapses repeated whitespace", () => {
    expect(sanitizeQuery("foo    bar")).toBe("foo bar");
  });

  it("removes empty quoted strings", () => {
    expect(sanitizeQuery('foo "" bar')).toBe("foo bar");
    expect(sanitizeQuery('"" foo')).toBe("foo");
    expect(sanitizeQuery('foo ""')).toBe("foo");
  });

  it("removes empty parentheses", () => {
    expect(sanitizeQuery("foo () bar")).toBe("foo bar");
  });

  it("removes dangling leading/trailing operators", () => {
    expect(sanitizeQuery("OR foo")).toBe("foo");
    expect(sanitizeQuery("foo OR")).toBe("foo");
    expect(sanitizeQuery("AND foo AND")).toBe("foo");
  });

  it("collapses doubled operators", () => {
    expect(sanitizeQuery("a OR OR b")).toBe("a OR b");
    expect(sanitizeQuery("a AND AND b")).toBe("a AND b");
  });

  it("removes stray/doubled commas", () => {
    expect(sanitizeQuery("a,, b")).toBe("a, b");
    expect(sanitizeQuery(", foo ,")).toBe("foo");
  });

  it("normalizes smart quotes", () => {
    expect(sanitizeQuery("\u201Cfoo\u201D")).toBe('"foo"');
  });

  it("cleans a fully junk input to an empty string", () => {
    expect(sanitizeQuery(' , "" OR OR , ')).toBe("");
  });
});

describe("buildGoogleQuery — placeholder substitution", () => {
  it("replaces unquoted and quoted placeholders", () => {
    expect(
      buildGoogleQuery('{industry} owners in {city}', filters({
        industry: "Bakery",
        city: "Austin",
      }))
    ).toBe("Bakery owners in Austin");

    expect(
      buildGoogleQuery('"{industry}" owners', filters({ industry: "Bakery" }))
    ).toBe('"Bakery" owners');
  });

  it("omits empty filters without leaving empty quotes", () => {
    const out = buildGoogleQuery('"{industry}" owners in {city}', filters({
      city: "Austin",
    }));
    expect(out).toBe("owners in Austin");
    expect(out).not.toContain('""');
    expect(out).not.toContain("  ");
  });

  it("omits every empty placeholder", () => {
    expect(buildGoogleQuery("{state} {country}", filters())).toBe("");
  });

  it("substitutes the current year dynamically", () => {
    expect(
      buildGoogleQuery("{year} {industry} trends", filters({ industry: "Bakery" }))
    ).toBe(`${new Date().getFullYear()} Bakery trends`);
  });
});

describe("buildGoogleQuery — roles", () => {
  it("single role stays unparenthesized", () => {
    expect(
      buildGoogleQuery('site:linkedin.com/in "{role}" {industry}', filters({
        roles: ["Owner"],
        industry: "Bakery",
      }))
    ).toBe('site:linkedin.com/in "Owner" Bakery');
  });

  it("multiple roles expand to a parenthesized OR group", () => {
    expect(
      buildGoogleQuery('"{role}" {industry}', filters({
        roles: ["Owner", "Founder"],
        industry: "Bakery",
      }))
    ).toBe('("Owner" OR "Founder") Bakery');
  });

  it("no roles selected expands to all roles", () => {
    expect(
      buildGoogleQuery('"{role}"', filters())
    ).toBe(ALL_ROLES_GROUP);
  });
});

describe("buildGoogleQuery — keywords", () => {
  it('"{keyword}" expands include keywords to an OR group', () => {
    expect(
      buildGoogleQuery('{industry} "{keyword}"', filters({
        industry: "Bakery",
        includeKeywords: ["cafe", "roastery"],
      }))
    ).toBe('Bakery ("cafe" OR "roastery")');

    expect(
      buildGoogleQuery('{industry} "{keyword}"', filters({
        industry: "Bakery",
        includeKeywords: ["cafe"],
      }))
    ).toBe('Bakery "cafe"');
  });

  it("appends include keywords when the template has no {keyword} placeholder", () => {
    expect(
      buildGoogleQuery("{industry} owners", filters({
        industry: "Bakery",
        includeKeywords: ["cafe", "roastery"],
      }))
    ).toBe('Bakery owners ("cafe" OR "roastery")');
  });

  it("appends exclusions with Google minus syntax", () => {
    expect(
      buildGoogleQuery("{industry} owners", filters({
        industry: "Bakery",
        excludeKeywords: ["jobs", "hiring"],
      }))
    ).toBe('Bakery owners -"jobs" -"hiring"');
  });

  it("dedupes and sanitizes keywords", () => {
    expect(
      buildGoogleQuery("{industry}", filters({
        industry: "Bakery",
        includeKeywords: ["cafe", "cafe", " extra "],
      }))
    ).toBe('Bakery ("cafe" OR "extra")');
  });
});

describe("buildGoogleQuery — company size", () => {
  it("appends the size keyword phrase when enabled", () => {
    expect(
      buildGoogleQuery("{industry}", filters({
        industry: "Bakery",
        companySize: "11-50",
        appendSizeKeywords: true,
      }))
    ).toBe('Bakery "11-50 employees"');

    expect(
      buildGoogleQuery("{industry}", filters({
        industry: "Bakery",
        companySize: "1-10",
        appendSizeKeywords: true,
      }))
    ).toBe('Bakery ("1-10 employees" OR "small business")');
  });

  it("ignores company size when the switch is off", () => {
    const out = buildGoogleQuery("{industry}", filters({
      industry: "Bakery",
      companySize: "11-50",
      appendSizeKeywords: false,
    }));
    expect(out).toBe("Bakery");
    expect(out).not.toContain("employees");
  });
});

describe("buildMapsQuery", () => {
  it("keeps a fully populated location phrase natural", () => {
    expect(
      buildMapsQuery("{industry} in {city}, {state}, {country}", filters({
        industry: "Coffee Shop",
        city: "Austin",
        state: "TX",
        country: "USA",
      }))
    ).toBe("Coffee Shop in Austin, TX, USA");
  });

  it("drops empty segments with their separators and prepositions", () => {
    expect(
      buildMapsQuery("{industry} in {city}, {state}, {country}", filters({
        industry: "Coffee Shop",
        country: "USA",
      }))
    ).toBe("Coffee Shop, USA");
  });

  it("returns an empty string when everything is empty", () => {
    expect(buildMapsQuery("{industry} in {city}", filters())).toBe("");
  });
});

describe("URL builders", () => {
  it("encodes the query for Google web search", () => {
    expect(buildGoogleUrl('a "b" c')).toBe(
      "https://www.google.com/search?q=a%20%22b%22%20c"
    );
  });

  it("appends the date-range parameter when set", () => {
    expect(buildGoogleUrl("x", "day")).toContain("&tbs=qdr:d");
    expect(buildGoogleUrl("x", "week")).toContain("&tbs=qdr:w");
    expect(buildGoogleUrl("x", "month")).toContain("&tbs=qdr:m");
    expect(buildGoogleUrl("x", "year")).toContain("&tbs=qdr:y");
    expect(buildGoogleUrl("x")).not.toContain("&tbs=");
    expect(buildGoogleUrl("x", "")).not.toContain("&tbs=");
  });

  it("builds the Maps deep-link with an encoded query", () => {
    expect(buildMapsUrl("coffee, Austin")).toBe(
      "https://www.google.com/maps/search/?api=1&query=coffee%2C%20Austin"
    );
  });
});

describe("isUsableQuery", () => {
  it("rejects empty and too-short queries", () => {
    expect(isUsableQuery("")).toBe(false);
    expect(isUsableQuery("  ")).toBe(false);
    expect(isUsableQuery("ab")).toBe(false);
    expect(isUsableQuery('("x")')).toBe(false);
  });

  it("accepts real queries, ignoring punctuation-only padding", () => {
    expect(isUsableQuery("Bakery owners")).toBe(true);
    expect(isUsableQuery("(abc)")).toBe(true);
    expect(isUsableQuery('("Owner" OR "Founder")')).toBe(true);
  });
});

describe("generateSearches", () => {
  const templates: TemplateDef[] = [
    {
      id: "g1",
      name: "Profiles",
      description: "",
      category: "linkedin-profiles",
      template: '{industry} "{role}"',
      engine: "google",
      sources: ["linkedin-profiles"],
    },
    {
      id: "g2",
      name: "Owners",
      description: "",
      category: "company-websites",
      template: "{industry} owners in {city}",
      engine: "google",
      sources: ["company-websites", "google"],
    },
    {
      id: "m1",
      name: "Maps",
      description: "",
      category: "google-maps",
      template: "{industry} in {city}",
      engine: "maps",
      sources: ["google-maps"],
    },
    {
      id: "bad",
      name: "Unusable",
      description: "",
      category: "custom",
      template: "{state} {country}",
      engine: "google",
      sources: ["google"],
    },
  ];

  it("drops templates whose query would be unusable", () => {
    const out = generateSearches(templates, filters({ industry: "Bakery" }));
    expect(out.map((r) => r.templateId)).toEqual(["g1", "g2", "m1"]);
    for (const r of out) expect(isUsableQuery(r.query)).toBe(true);
  });

  it("filters by category from options", () => {
    const out = generateSearches(templates, filters({ industry: "Bakery" }), {
      category: "google-maps",
    });
    expect(out.map((r) => r.templateId)).toEqual(["m1"]);
  });

  it("falls back to filters.category when options omit it", () => {
    const out = generateSearches(
      templates,
      filters({ industry: "Bakery", category: "company-websites" })
    );
    expect(out.map((r) => r.templateId)).toEqual(["g2"]);
  });

  it("filters by selected sources", () => {
    const out = generateSearches(templates, filters({ industry: "Bakery" }), {
      sources: ["google-maps"],
    });
    expect(out.map((r) => r.templateId)).toEqual(["m1"]);
  });

  it("keeps templates matching any selected source", () => {
    const out = generateSearches(templates, filters({ industry: "Bakery" }), {
      sources: ["google", "google-maps"],
    });
    expect(out.map((r) => r.templateId)).toEqual(["g2", "m1"]);
  });

  it("empty source selection means no source restriction", () => {
    const out = generateSearches(templates, filters({ industry: "Bakery" }), {
      sources: [],
    });
    expect(out).toHaveLength(3);
  });

  it("picks engine-appropriate URLs and applies the date range to Google only", () => {
    const out = generateSearches(
      templates,
      filters({ industry: "Bakery", dateRange: "week" })
    );
    const google = out.find((r) => r.engine === "google");
    const maps = out.find((r) => r.engine === "maps");
    expect(google?.url).toContain("https://www.google.com/search?q=");
    expect(google?.url).toContain("&tbs=qdr:w");
    expect(maps?.url).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(maps?.url).not.toContain("&tbs=");
  });

  it("uses the maps engine's phrase builder for maps templates", () => {
    const out = generateSearches(templates, filters({
      industry: "Coffee Shop",
      city: "Austin",
    }));
    const maps = out.find((r) => r.templateId === "m1");
    expect(maps?.query).toBe("Coffee Shop in Austin");
  });
});

describe("describeFilters", () => {
  it("builds a human label from populated filters", () => {
    expect(
      describeFilters(
        filters({
          industry: "Bakery",
          city: "Austin",
          country: "USA",
          roles: ["Owner", "Founder"],
          companySize: "11-50",
          dateRange: "week",
        })
      )
    ).toBe("Bakery · Austin, USA · Owner/Founder · 11-50 staff · Past week");
  });

  it("omits the full role list and empty fields", () => {
    expect(describeFilters(filters({ industry: "Bakery" }))).toBe("Bakery");
  });

  it("returns an empty label for empty filters", () => {
    expect(describeFilters(filters())).toBe("");
  });
});

describe("hasMinimumFilters", () => {
  it("requires an industry or a city", () => {
    expect(hasMinimumFilters(filters())).toBe(false);
    expect(hasMinimumFilters(filters({ industry: "Bakery" }))).toBe(true);
    expect(hasMinimumFilters(filters({ city: "Austin" }))).toBe(true);
    expect(hasMinimumFilters(filters({ country: "USA" }))).toBe(false);
  });
});
