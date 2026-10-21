import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ saved: z.boolean() });

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid search payload" },
        { status: 400 }
      );
    }

    const existing = await prisma.searchHistory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    const row = await prisma.searchHistory.update({
      where: { id },
      data: { saved: parsed.data.saved },
    });

    return NextResponse.json(row);
  } catch (error) {
    console.error("PATCH /api/searches/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.searchHistory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }
    await prisma.searchHistory.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/searches/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
