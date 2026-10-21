import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { searchTemplateInputSchema } from "@/lib/validations";
import { sourcesToDb, templateRowToDto } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureSeeded();

    const sp = req.nextUrl.searchParams;
    const where: Prisma.SearchTemplateWhereInput = {};

    const category = sp.get("category");
    if (category) where.category = category;

    if (sp.get("favorite") === "true") where.isFavorite = true;

    const rows = await prisma.searchTemplate.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ items: rows.map(templateRowToDto) });
  } catch (error) {
    console.error("GET /api/templates failed:", error);
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

    const parsed = searchTemplateInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid template payload" },
        { status: 400 }
      );
    }

    const { sources, ...rest } = parsed.data;

    const row = await prisma.searchTemplate.create({
      data: {
        ...rest,
        sources: sourcesToDb(sources),
        isSystem: false,
      },
    });

    return NextResponse.json(templateRowToDto(row), { status: 201 });
  } catch (error) {
    console.error("POST /api/templates failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
