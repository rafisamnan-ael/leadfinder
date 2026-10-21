import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { listSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

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

    const parsed = listSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid list payload" },
        { status: 400 }
      );
    }

    const name = parsed.data.name;

    const existing = await prisma.leadList.findUnique({
      where: { id },
      include: { _count: { select: { leads: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const all = await prisma.leadList.findMany();
    const clash = all.find(
      (list) =>
        list.id !== id &&
        list.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (clash) {
      return NextResponse.json(
        { error: "A list with this name already exists" },
        { status: 409 }
      );
    }

    const list = await prisma.leadList.update({
      where: { id },
      data: { name },
      include: { _count: { select: { leads: true } } },
    });

    return NextResponse.json({
      id: list.id,
      name: list.name,
      createdAt: list.createdAt,
      leadCount: list._count.leads,
    });
  } catch (error) {
    console.error("PUT /api/lists/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.leadList.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }
    await prisma.leadList.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/lists/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
