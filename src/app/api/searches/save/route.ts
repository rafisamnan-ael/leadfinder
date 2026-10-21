import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { saveSearchSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 1000;
const MAX_QUERIES = 50;

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = saveSearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid search payload" },
        { status: 400 }
      );
    }

    const { query, queries, engine, label, category, filters } = parsed.data;
    const filtersJson = JSON.stringify(filters);

    const shared = {
      engine,
      label: label ?? null,
      category: category ?? null,
      filters: filtersJson,
      saved: true,
      templateId: null,
      templateName: null,
    };

    if (queries && queries.length > 0) {
      const cleaned = queries
        .map((q) => q.trim())
        .filter((q) => q.length > 0)
        .slice(0, MAX_QUERIES);

      if (cleaned.length === 0) {
        return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
      }

      const items = await prisma.$transaction(
        cleaned.map((q) =>
          prisma.searchHistory.create({
            data: { ...shared, query: q.slice(0, MAX_QUERY_LENGTH) },
          })
        )
      );

      return NextResponse.json(
        { items, count: items.length },
        { status: 201 }
      );
    }

    if (query && query.trim().length > 0) {
      const row = await prisma.searchHistory.create({
        data: { ...shared, query: query.trim().slice(0, MAX_QUERY_LENGTH) },
      });
      return NextResponse.json({ items: [row], count: 1 }, { status: 201 });
    }

    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/searches/save failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
