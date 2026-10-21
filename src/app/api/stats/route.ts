import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { templateRowToDto } from "@/lib/mappers";
import { LEAD_STATUSES } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();

    const [
      totalLeads,
      qualifiedLeads,
      contactedLeads,
      newLeads,
      wonLeads,
      byCountryRaw,
      byIndustryRaw,
      byStatusRaw,
      recentSearches,
      recentLeads,
      favoriteTemplates,
      totalTemplates,
      totalSearches,
      totalLists,
      lists,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: "Qualified" } }),
      prisma.lead.count({ where: { status: { in: ["Contacted", "Replied"] } } }),
      prisma.lead.count({ where: { status: "New" } }),
      prisma.lead.count({ where: { status: "Won" } }),
      prisma.lead.groupBy({
        by: ["country"],
        _count: { _all: true },
        where: { country: { not: "" } },
      }),
      prisma.lead.groupBy({
        by: ["industry"],
        _count: { _all: true },
        where: { industry: { not: "" } },
      }),
      prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.searchHistory.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
      prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
      prisma.searchTemplate.findMany({
        where: { isFavorite: true },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      prisma.searchTemplate.count(),
      prisma.searchHistory.count(),
      prisma.leadList.count(),
      prisma.leadList.findMany({
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { leads: true } } },
      }),
    ]);

    const byCountry = byCountryRaw
      .map((row) => ({ name: (row.country ?? "").trim(), count: row._count._all }))
      .filter((row) => row.name !== "")
      .sort((a, b) => b.count - a.count);

    const byIndustry = byIndustryRaw
      .map((row) => ({ name: (row.industry ?? "").trim(), count: row._count._all }))
      .filter((row) => row.name !== "")
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const statusCounts = new Map(
      byStatusRaw.map((row) => [row.status, row._count._all])
    );
    const pipeline = LEAD_STATUSES.map((status) => ({
      status,
      count: statusCounts.get(status) ?? 0,
    }));

    return NextResponse.json({
      totalLeads,
      qualifiedLeads,
      contactedLeads,
      newLeads,
      wonLeads,
      byCountry,
      byIndustry,
      pipeline,
      recentSearches,
      recentLeads,
      favoriteTemplates: favoriteTemplates.map(templateRowToDto),
      totals: {
        totalTemplates,
        totalSearches,
        totalLists,
        lists: lists.map((list) => ({
          id: list.id,
          name: list.name,
          leadCount: list._count.leads,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/stats failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
