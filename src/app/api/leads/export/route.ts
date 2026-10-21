import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { toCsv, csvHeaderRow, LEAD_CSV_COLUMNS } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const and: Prisma.LeadWhereInput[] = [];

    const term = (sp.get("q") ?? "").trim();
    if (term) {
      and.push({
        OR: [
          { businessName: { contains: term } },
          { industry: { contains: term } },
          { founderName: { contains: term } },
          { website: { contains: term } },
          { tags: { contains: term } },
          { notes: { contains: term } },
        ],
      });
    }

    const status = sp.get("status");
    if (status) and.push({ status });

    const country = sp.get("country");
    if (country) and.push({ country });

    const industry = sp.get("industry");
    if (industry) and.push({ industry });

    if (sp.get("favorite") === "true") and.push({ favorite: true });

    const listId = sp.get("listId");
    if (listId) and.push({ lists: { some: { id: listId } } });

    const where: Prisma.LeadWhereInput = and.length > 0 ? { AND: and } : {};

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { businessName: "asc" },
      take: 10000,
    });

    const rows: string[][] = [csvHeaderRow()];
    for (const lead of leads) {
      const source: Record<string, string | null> = {
        businessName: lead.businessName,
        website: lead.website,
        founderName: lead.founderName,
        jobTitle: lead.jobTitle,
        industry: lead.industry,
        country: lead.country,
        state: lead.state,
        city: lead.city,
        email: lead.email,
        phone: lead.phone,
        linkedinUrl: lead.linkedinUrl,
        sourceUrl: lead.sourceUrl,
        notes: lead.notes,
        tags: lead.tags,
        status: lead.status,
      };
      rows.push(LEAD_CSV_COLUMNS.map((column) => source[column.key] ?? ""));
    }

    const csv = toCsv(rows);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="leadfinder-leads.csv"',
      },
    });
  } catch (error) {
    console.error("GET /api/leads/export failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
