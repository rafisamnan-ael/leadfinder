import { z } from "zod";

export const LEAD_STATUSES = [
  "New",
  "Researching",
  "Qualified",
  "Contacted",
  "Replied",
  "Won",
  "Lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

const optionalTrimmed = z
  .string()
  .transform((v) => v.trim())
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const statusEnum = z.enum(LEAD_STATUSES);

export const leadInputSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, "Business name is required")
    .max(200, "Business name is too long"),
  website: optionalTrimmed,
  founderName: optionalTrimmed,
  jobTitle: optionalTrimmed,
  industry: optionalTrimmed,
  country: optionalTrimmed,
  state: optionalTrimmed,
  city: optionalTrimmed,
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  phone: optionalTrimmed,
  linkedinUrl: optionalTrimmed,
  sourceUrl: optionalTrimmed,
  notes: optionalTrimmed,
  tags: optionalTrimmed,
  status: statusEnum.default("New"),
  favorite: z.boolean().optional().default(false),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

export const leadListQuerySchema = z.object({
  q: z.string().optional().default(""),
  status: z.string().optional().default(""),
  country: z.string().optional().default(""),
  industry: z.string().optional().default(""),
  favorite: z.enum(["true", "false"]).optional(),
  listId: z.string().optional().default(""),
  sort: z
    .enum(["businessName", "status", "createdAt", "country", "industry"])
    .optional()
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(20),
});
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;

export const bulkLeadActionSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one lead"),
  action: z.enum(["setStatus", "delete", "setFavorite", "addToList", "removeFromList"]),
  status: statusEnum.optional(),
  listId: z.string().optional(),
  favorite: z.boolean().optional(),
});

export const searchTemplateInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(400).optional().default(""),
  category: z.string().trim().min(1, "Category is required"),
  template: z
    .string()
    .trim()
    .min(1, "Template is required")
    .refine(
      (v) => v.includes("{") || v.length > 0,
      "Template looks invalid"
    ),
  engine: z.enum(["google", "maps"]).default("google"),
  sources: z.array(z.string()).default([]),
  isFavorite: z.boolean().optional().default(false),
});
export type SearchTemplateInput = z.infer<typeof searchTemplateInputSchema>;

export const searchLogSchema = z.object({
  query: z.string().trim().min(1),
  engine: z.enum(["google", "maps"]).default("google"),
  templateId: z.string().optional().nullable(),
  templateName: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
  filters: z.record(z.string(), z.unknown()).optional().default({}),
});

export const saveSearchSchema = z.object({
  query: z.string().trim().min(1).optional(),
  queries: z.array(z.string()).optional(),
  engine: z.enum(["google", "maps"]).default("google"),
  label: z.string().trim().max(160).optional(),
  category: z.string().optional().nullable(),
  filters: z.record(z.string(), z.unknown()).default({}),
});

export const settingsSchema = z.object({
  defaultCountry: z.string().optional().default(""),
  defaultIndustry: z.string().optional().default(""),
  defaultCity: z.string().optional().default(""),
  pageSize: z.coerce.number().int().min(10).max(200).optional().default(20),
  appendSizeKeywords: z.boolean().optional().default(false),
  dateRange: z.enum(["", "day", "week", "month", "year"]).optional().default(""),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const listSchema = z.object({
  name: z.string().trim().min(1, "List name is required").max(80),
});

export const importOptionsSchema = z.object({
  listId: z.string().optional().nullable(),
  skipDuplicates: z.boolean().optional().default(true),
});
