import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { leadInputSchema, leadListQuerySchema } from "@/lib/validations";
import { normalizeName, normalizeWebsite } from "@/lib/utils";

export const dynamic = "force-dynamic";

const leadCreateSchema = z.object({
  ...leadInputSchema.shape,
  force: z.boolean().optional(),
});

type SortField =
  | "businessName"
  | "status"
  | "createdAt"
  | "country"
  | "industry";

function buildOrderBy(sort: SortField, order: "asc" | "desc") {
  switch (sort) {
    case "businessName":
      return { businessName: order } satisfies Prisma.LeadOrderByWithRelationInput;
    case "status":
      return { status: order } satisfies Prisma.LeadOrderByWithRelationInput;
    case "country":
      return { country: order } satisfies Prisma.LeadOrderByWithRelationInput;
    case "industry":
      return { industry: order } satisfies Prisma.LeadOrderByWithRelationInput;
    case "createdAt":
    default:
      return { createdAt: order } satisfies Prisma.LeadOrderByWithRelationInput;
  }
}

/**
 * Looks for an existing lead with the same normalized business name or
 * website. Candidates are pre-filtered with a cheap SQL `contains` lookup and
 * the exact comparison is done in JS (SQLite has no case-insensitive mode).
 */
async function findDuplicate(businessName: string, website?: string) {
  const name = normalizeName(businessName);
  const site = normalizeWebsite(website);
  const host = site.split("/")[0] ?? "";
  const firstWord = name.split(" ")[0] ?? "";

  const or: Prisma.LeadWhereInput[] = [];
  if (firstWord) or.push({ businessName: { contains: firstWord } });
  if (host) or.push({ website: { contains: host } });
  if (or.length === 0) return null;

  const candidates = await prisma.lead.findMany({
    where: { OR: or },
    include: { lists: true },
    take: 500,
  });

  return (
    candidates.find((lead) => {
      const nameMatches = name !== "" && normalizeName(lead.businessName) === name;
      const siteMatches = site !== "" && normalizeWebsite(lead.website) === site;
      return nameMatches || siteMatches;
    }) ?? null
  );
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const raw = {
      q: sp.get("q") ?? undefined,
      status: sp.get("status") ?? undefined,
      country: sp.get("country") ?? undefined,
      industry: sp.get("industry") ?? undefined,
      favorite: sp.get("favorite") ?? undefined,
      listId: sp.get("listId") ?? undefined,
      sort: sp.get("sort") ?? undefined,
      order: sp.get("order") ?? undefined,
      page: sp.get("page") ?? undefined,
      pageSize: sp.get("pageSize") ?? undefined,
    };

    let parsed = leadListQuerySchema.safeParse(raw);
    if (!parsed.success && raw.favorite !== undefined) {
      // The `favorite` enum of the shared query schema rejects valid values
      // with some zod versions, so fall back to reading the flag directly.
      parsed = leadListQuerySchema.safeParse({ ...raw, favorite: undefined });
    }
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query parameters" },
        { status: 400 }
      );
    }

    const query = parsed.data;
    const and: Prisma.LeadWhereInput[] = [];

    const term = query.q.trim();
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
    if (query.status) and.push({ status: query.status });
    if (query.country) and.push({ country: query.country });
    if (query.industry) and.push({ industry: query.industry });
    if (raw.favorite === "true") and.push({ favorite: true });
    if (query.listId) and.push({ lists: { some: { id: query.listId } } });

    const where: Prisma.LeadWhereInput = and.length > 0 ? { AND: and } : {};
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await prisma.$transaction([
      prisma.lead.findMany({
        where,
        include: { lists: true },
        orderBy: buildOrderBy(query.sort as SortField, query.order),
        skip,
        take: query.pageSize,
      }),
      prisma.lead.count({ where }),
    ]);

    const pages = Math.max(1, Math.ceil(total / query.pageSize));
    return NextResponse.json({
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages,
    });
  } catch (error) {
    console.error("GET /api/leads failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = leadCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid lead payload" },
        { status: 400 }
      );
    }

    const { force, ...data } = parsed.data;

    if (!force) {
      const existing = await findDuplicate(data.businessName, data.website);
      if (existing) {
        return NextResponse.json(
          {
            error:
              "Duplicate lead: a lead with the same name or website already exists",
            existing,
          },
          { status: 409 }
        );
      }
    }

    const lead = await prisma.lead.create({
      data: { ...data },
      include: { lists: true },
    });
    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("POST /api/leads failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
