import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { leadInputSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const leadUpdateSchema = z.object({ ...leadInputSchema.shape }).partial();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { lists: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return NextResponse.json(lead);
  } catch (error) {
    console.error("GET /api/leads/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = leadUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid lead payload" },
        { status: 400 }
      );
    }

    // `.partial()` still fills in the schema defaults, so only the fields that
    // are actually present in the request body are written back.
    const rawBody = (body ?? {}) as Record<string, unknown>;
    const provided = new Set(Object.keys(rawBody));
    const parsedData = parsed.data as Record<string, unknown>;
    const update: Prisma.LeadUpdateInput = {};
    const bag = update as unknown as Record<string, unknown>;

    for (const key of Object.keys(leadInputSchema.shape)) {
      if (!provided.has(key)) continue;
      const value = parsedData[key];
      if (value === undefined) continue;
      bag[key] = value;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    if (
      typeof update.businessName === "string" &&
      update.businessName.trim().length === 0
    ) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    }

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: update,
      include: { lists: true },
    });
    return NextResponse.json(lead);
  } catch (error) {
    console.error("PUT /api/leads/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    await prisma.lead.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/leads/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
