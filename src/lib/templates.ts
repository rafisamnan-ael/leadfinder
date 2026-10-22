import type { TemplateDef } from "./query-engine";

/**
 * Optimized search patterns focused on finding decision makers and local businesses.
 * The user selects filters, and these patterns generate precise Google/LinkedIn queries.
 */
export const SYSTEM_TEMPLATES: TemplateDef[] = [
  /* LinkedIn Decision Makers ----------------------------------------- */
  {
    id: "dm-1",
    name: "LinkedIn: Decision Maker (Role + City + Industry)",
    description: "Exact match for professional profiles on LinkedIn.",
    category: "linkedin-profiles",
    template: 'site:linkedin.com/in/ "{role}" "{city}" "{industry}"',
    engine: "google",
    sources: ["linkedin-profiles", "google"],
  },
  {
    id: "dm-2",
    name: "LinkedIn: Role in Country + Industry",
    description: "Find decision makers across the whole country.",
    category: "linkedin-profiles",
    template: 'site:linkedin.com/in/ "{role}" "{country}" "{industry}"',
    engine: "google",
    sources: ["linkedin-profiles", "google"],
  },
  {
    id: "dm-3",
    name: "LinkedIn: Combined Search (Owner OR Founder OR CEO)",
    description: "Broad reach for any senior decision maker.",
    category: "linkedin-profiles",
    template: 'site:linkedin.com/in/ ("Owner" OR "Founder" OR "CEO") "{city}" "{industry}"',
    engine: "google",
    sources: ["linkedin-profiles", "google"],
  },

  /* Local Business Discovery ----------------------------------------- */
  {
    id: "map-1",
    name: "Google Maps: Industry in City",
    description: "Search for local business listings via Google Maps.",
    category: "google-maps",
    template: "{industry} in {city}, {country}",
    engine: "maps",
    sources: ["google-maps"],
  },
  {
    id: "web-1",
    name: "Company Website: Owner Mentions",
    description: "Search business websites for mentions of their owner.",
    category: "company-websites",
    template: '"{industry}" "{city}" "owner"',
    engine: "google",
    sources: ["company-websites", "google"],
  },
  {
    id: "web-2",
    name: "Company Website: Contact Page",
    description: "Find official contact/get-in-touch pages for outreach.",
    category: "company-websites",
    template: '"{industry}" "{city}" "contact us"',
    engine: "google",
    sources: ["company-websites", "google"],
  },
  {
    id: "web-3",
    name: "Company Website: Meet the Team",
    description: "Team pages often name owners and founders.",
    category: "company-websites",
    template: '"{industry}" "{city}" "meet the team"',
    engine: "google",
    sources: ["company-websites", "google"],
  },
];
