import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { leadInputSchema } from "@/lib/validations";
import { parseCsv, csvRowsToLeads } from "@/lib/csv";
import { normalizeName, normalizeWebsite } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Same normalization rules as POST /api/leads: an existing lead with the same
 * normalized business name or website counts as a duplicate.
 */
async function findDuplicate(businessName: string, website?: string) {
  const name = normalizeName(businessName);
  const site = normalizeWebsite(website);
  const host = site.split("/")[0] ?? "";
  const firstWord = name.split(" ")[0] ?? "";

  const or: Prisma.LeadWhereInput[] = [];
  if (firstWord) or.push({ businessName: { contains: firstWord } });
  if (host) or.push({ website: { contains: host } });
  if (or.length === 0) return null;

  const candidates = await prisma.lead.findMany({
    where: { OR: or },
    select: { id: true, businessName: true, website: true },
    take: 500,
  });

  return (
    candidates.find((lead) => {
      const nameMatches = name !== "" && normalizeName(lead.businessName) === name;
      const siteMatches = site !== "" && normalizeWebsite(lead.website) === site;
      return nameMatches || siteMatches;
    }) ?? null
  );
}

export async function POST(req: NextRequest) {
  try {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File is too large (maximum 5MB)" },
        { status: 413 }
      );
    }

    const skipDuplicates =
      String(form.get("skipDuplicates") ?? "true").toLowerCase() !== "false";

    const listIdRaw = form.get("listId");
    const listId =
      typeof listIdRaw === "string" && listIdRaw.trim() !== ""
        ? listIdRaw.trim()
        : null;

    if (listId) {
      const list = await prisma.leadList.findUnique({ where: { id: listId } });
      if (!list) {
        return NextResponse.json({ error: "List not found" }, { status: 404 });
      }
    }

    const rawRows = parseCsv(await file.text());
    const dataRowCount = rawRows.length > 0 ? rawRows.length - 1 : 0;
    const rows = csvRowsToLeads(rawRows);

    let imported = 0;
    let skipped = 0;
    let invalid = Math.max(0, dataRowCount - rows.length);

    const seenNames = new Set<string>();
    const seenSites = new Set<string>();

    for (const row of rows) {
      // An empty Status cell should fall back to the default status instead of
      // failing validation.
      const candidate: Record<string, string> = { ...row };
      if (!candidate.status) delete candidate.status;

      const parsed = leadInputSchema.safeParse(candidate);
      if (!parsed.success) {
        invalid += 1;
        continue;
      }

      const data = parsed.data;
      const name = normalizeName(data.businessName);
      const site = normalizeWebsite(data.website);

      if (skipDuplicates) {
        const duplicateInFile =
          seenNames.has(name) || (site !== "" && seenSites.has(site));
        if (duplicateInFile) {
          skipped += 1;
          continue;
        }

        const existing = await findDuplicate(data.businessName, data.website);
        if (existing) {
          skipped += 1;
          continue;
        }
      }

      seenNames.add(name);
      if (site !== "") seenSites.add(site);

      await prisma.lead.create({
        data: {
          ...data,
          ...(listId ? { lists: { connect: { id: listId } } } : {}),
        },
      });
      imported += 1;
    }

    return NextResponse.json({
      imported,
      skipped,
      invalid,
      total: dataRowCount,
    });
  } catch (error) {
    console.error("POST /api/leads/import failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
