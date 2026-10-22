import type { TemplateDef } from "./query-engine";

/**
 * Optimized, high-precision search patterns.
 * 
 * Placeholders supported: {industry} {city} {state} {country} {role}
 */
export const SYSTEM_TEMPLATES: TemplateDef[] = [
  /* LinkedIn: Finding decision makers -------------------------------- */
  {
    id: "lnk-1",
    name: "LinkedIn: Decision Maker (Role + Location)",
    description: "Exact profiles in industry/location.",
    category: "linkedin-profiles",
    template: 'site:linkedin.com/in/ "{role}" "{industry}" "{city}" "{state}" "{country}"',
    engine: "google",
    sources: ["linkedin-profiles", "google"],
  },
  {
    id: "lnk-2",
    name: "LinkedIn: Role in Country",
    description: "Broad reach for roles country-wide.",
    category: "linkedin-profiles",
    template: 'site:linkedin.com/in/ "{role}" "{industry}" "{country}"',
    engine: "google",
    sources: ["linkedin-profiles", "google"],
  },

  /* Facebook & Social: Local Businesses ------------------------------ */
  {
    id: "soc-1",
    name: "Facebook: Business Pages",
    description: "Public business profiles on Facebook.",
    category: "communities",
    template: 'site:facebook.com "{industry}" "{city}" "{state}"',
    engine: "google",
    sources: ["google"],
  },
  {
    id: "soc-2",
    name: "Instagram: Local Profiles",
    description: "Public business profiles on Instagram.",
    category: "communities",
    template: 'site:instagram.com "{industry}" "{city}" "{state}"',
    engine: "google",
    sources: ["google"],
  },

  /* Web/Direct: Local Business Discovery ----------------------------- */
  {
    id: "web-1",
    name: "Website: Owner Mentions",
    description: 'Websites mentioning "owner" or "founder".',
    category: "company-websites",
    template: '"{industry}" "{city}" "{state}" ("owner" OR "founder")',
    engine: "google",
    sources: ["company-websites", "google"],
  },
  {
    id: "web-2",
    name: "Website: Contact/Inquiry Pages",
    description: "Find contact, inquiry, or booking pages.",
    category: "contact-pages",
    template: '"{industry}" "{city}" "{state}" ("contact" OR "inquiries")',
    engine: "google",
    sources: ["company-websites", "google"],
  },

  /* Google Maps: Business Discovery ---------------------------------- */
  {
    id: "map-1",
    name: "Maps: Business in Area",
    description: "{industry} in {city}, {state}, {country}",
    category: "google-maps",
    template: "{industry} in {city}, {state}, {country}",
    engine: "maps",
    sources: ["google-maps"],
  },
];

