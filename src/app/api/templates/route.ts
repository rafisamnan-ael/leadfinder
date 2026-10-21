import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { searchTemplateInputSchema } from "@/lib/validations";
import { sourcesToDb, templateRowToDto } from "@/lib/mappers";
import { SYSTEM_TEMPLATES } from "@/lib/templates";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category");
  const favOnly = sp.get("favorite") === "true";

  try {
    await ensureSeeded();

    const where: Prisma.SearchTemplateWhereInput = {};
    if (category) where.category = category;
    if (favOnly) where.isFavorite = true;

    const rows = await prisma.searchTemplate.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ items: rows.map(templateRowToDto) });
  } catch {
    const now = new Date().toISOString();
    let items = SYSTEM_TEMPLATES.map((t, i) => ({
      id: `sys-${i}`,
      name: t.name,
      description: t.description,
      category: t.category,
      template: t.template,
      engine: t.engine,
      sources: t.sources ?? [],
      isSystem: true,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    }));
    if (category) items = items.filter((t) => t.category === category);
    if (favOnly) items = [];
    items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    return NextResponse.json({ items });
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
