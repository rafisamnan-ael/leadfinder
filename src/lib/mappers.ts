import type { SearchTemplate } from "@prisma/client";

import type { CategoryId, SearchEngine, SourceId, TemplateDef } from "@/lib/query-engine";

/** Serialized template shape used across API + UI. */
export interface TemplateDto {
  id: string;
  name: string;
  description: string;
  category: string;
  template: string;
  engine: string;
  sources: SourceId[];
  isSystem: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryDto {
  id: string;
  query: string;
  engine: string;
  templateId: string | null;
  templateName: string | null;
  category: string | null;
  label: string | null;
  filters: string;
  saved: boolean;
  createdAt: string;
}

export interface ListDto {
  id: string;
  name: string;
  createdAt: string;
  leadCount?: number;
}

export function sourcesToDb(sources: string[] | undefined): string {
  return (sources ?? []).map((s) => s.trim()).filter(Boolean).join(",");
}

export function sourcesFromDb(value: string | null | undefined): SourceId[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as SourceId[];
}

export function templateRowToDto(row: SearchTemplate): TemplateDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    category: row.category,
    template: row.template,
    engine: row.engine,
    sources: sourcesFromDb(row.sources),
    isSystem: row.isSystem,
    isFavorite: row.isFavorite,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** DB row → engine TemplateDef (ready for generateSearches). */
export function templateRowToDef(row: SearchTemplate): TemplateDef {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    category: row.category as CategoryId,
    template: row.template,
    engine: row.engine as SearchEngine,
    sources: sourcesFromDb(row.sources),
  };
}
