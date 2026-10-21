import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { listSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const lists = await prisma.leadList.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { leads: true } } },
    });

    return NextResponse.json({
      items: lists.map((list) => ({
        id: list.id,
        name: list.name,
        createdAt: list.createdAt,
        leadCount: list._count.leads,
      })),
    });
  } catch (error) {
    console.error("GET /api/lists failed:", error);
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

    const parsed = listSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid list payload" },
        { status: 400 }
      );
    }

    const name = parsed.data.name;

    const existing = await prisma.leadList.findMany();
    const clash = existing.find(
      (list) => list.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (clash) {
      return NextResponse.json(
        { error: "A list with this name already exists" },
        { status: 409 }
      );
    }

    const list = await prisma.leadList.create({ data: { name } });
    return NextResponse.json(
      { id: list.id, name: list.name, createdAt: list.createdAt, leadCount: 0 },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/lists failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
