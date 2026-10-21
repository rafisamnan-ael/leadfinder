import { prisma } from "@/lib/prisma";
import { sourcesToDb } from "@/lib/mappers";
import { SYSTEM_TEMPLATES } from "@/lib/templates";

/**
 * Idempotent seed: creates the built-in template library the first time
 * the app runs (only when no templates exist at all, so user deletions
 * and edits are never overwritten).
 */
export async function ensureSeeded(): Promise<boolean> {
  const count = await prisma.searchTemplate.count();
  if (count > 0) return false;

  await prisma.searchTemplate.createMany({
    data: SYSTEM_TEMPLATES.map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
      template: t.template,
      engine: t.engine,
      sources: sourcesToDb(t.sources),
      isSystem: true,
    })),
  });

  const settings = await prisma.setting.count();
  if (settings === 0) {
    await prisma.setting.createMany({
      data: [
        { key: "defaultCountry", value: "USA" },
        { key: "defaultIndustry", value: "" },
        { key: "defaultCity", value: "" },
        { key: "pageSize", value: "20" },
        { key: "appendSizeKeywords", value: "false" },
        { key: "dateRange", value: "" },
      ],
    });
  }
  return true;
}
