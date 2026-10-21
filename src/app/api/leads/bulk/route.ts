import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { bulkLeadActionSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = bulkLeadActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid bulk payload" },
        { status: 400 }
      );
    }

    const { ids, action, status, listId, favorite } = parsed.data;

    if (action === "setStatus") {
      if (!status) {
        return NextResponse.json(
          { error: "A status is required for the setStatus action" },
          { status: 400 }
        );
      }
      const result = await prisma.lead.updateMany({
        where: { id: { in: ids } },
        data: { status },
      });
      return NextResponse.json({ count: result.count });
    }

    if (action === "setFavorite") {
      if (favorite === undefined) {
        return NextResponse.json(
          { error: "A favorite value is required for the setFavorite action" },
          { status: 400 }
        );
      }
      const result = await prisma.lead.updateMany({
        where: { id: { in: ids } },
        data: { favorite },
      });
      return NextResponse.json({ count: result.count });
    }

    if (action === "delete") {
      const result = await prisma.lead.deleteMany({
        where: { id: { in: ids } },
      });
      return NextResponse.json({ count: result.count });
    }

    // addToList / removeFromList
    if (!listId) {
      return NextResponse.json(
        { error: "A list id is required for this action" },
        { status: 400 }
      );
    }

    const list = await prisma.leadList.findUnique({ where: { id: listId } });
    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const existing = await prisma.lead.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (existing.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    const count = await prisma.$transaction(async (tx) => {
      let affected = 0;
      for (const lead of existing) {
        try {
          if (action === "addToList") {
            await tx.lead.update({
              where: { id: lead.id },
              data: { lists: { connect: { id: listId } } },
            });
          } else {
            await tx.lead.update({
              where: { id: lead.id },
              data: { lists: { disconnect: { id: listId } } },
            });
          }
          affected += 1;
        } catch (error) {
          console.error(
            `Bulk ${action} failed for lead ${lead.id}:`,
            error
          );
        }
      }
      return affected;
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("PATCH /api/leads/bulk failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
