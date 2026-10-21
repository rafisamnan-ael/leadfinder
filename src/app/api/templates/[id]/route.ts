import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { searchTemplateInputSchema } from "@/lib/validations";
import { sourcesToDb, templateRowToDto } from "@/lib/mappers";

export const dynamic = "force-dynamic";

const templateUpdateSchema = searchTemplateInputSchema.partial();

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = templateUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid template payload" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // `.partial()` still fills in the schema defaults, so only the fields that
    // are actually present in the request body are written back.
    const rawBody = (body ?? {}) as Record<string, unknown>;
    const provided = new Set(Object.keys(rawBody));
    const parsedData = data as Record<string, unknown>;
    const update: Prisma.SearchTemplateUpdateInput = {};
    const bag = update as unknown as Record<string, unknown>;

    for (const key of Object.keys(searchTemplateInputSchema.shape)) {
      if (!provided.has(key)) continue;
      const value = parsedData[key];
      if (value === undefined) continue;
      bag[key] = key === "sources" ? sourcesToDb(value as string[]) : value;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const existing = await prisma.searchTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const row = await prisma.searchTemplate.update({ where: { id }, data: update });
    return NextResponse.json(templateRowToDto(row));
  } catch (error) {
    console.error("PUT /api/templates/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.searchTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    await prisma.searchTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/templates/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
