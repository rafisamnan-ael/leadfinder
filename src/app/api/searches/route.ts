import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { searchLogSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 1000;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const where: Prisma.SearchHistoryWhereInput = {};

    const saved = sp.get("saved");
    if (saved === "true") where.saved = true;
    else if (saved === "false") where.saved = false;

    const rawLimit = Number(sp.get("limit") ?? "50");
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(1, Math.floor(rawLimit)), 200)
      : 50;

    const items = await prisma.searchHistory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/searches failed:", error);
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

    const parsed = searchLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid search payload" },
        { status: 400 }
      );
    }

    const { filters, ...rest } = parsed.data;

    const row = await prisma.searchHistory.create({
      data: {
        query: rest.query.slice(0, MAX_QUERY_LENGTH),
        engine: rest.engine,
        templateId: rest.templateId ?? null,
        templateName: rest.templateName ?? null,
        category: rest.category ?? null,
        label: rest.label ?? null,
        filters: JSON.stringify(filters),
        saved: false,
      },
    });

    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error("POST /api/searches failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get("scope");
    const where: Prisma.SearchHistoryWhereInput =
      scope === "saved" ? { saved: true } : {};

    const result = await prisma.searchHistory.deleteMany({ where });
    return NextResponse.json({ count: result.count });
  } catch (error) {
    console.error("DELETE /api/searches failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
