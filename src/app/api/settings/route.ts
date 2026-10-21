import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ensureSeeded } from "@/lib/seed";
import { settingsSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS = {
  defaultCountry: "USA",
  defaultIndustry: "",
  defaultCity: "",
  pageSize: 20,
  appendSizeKeywords: false,
  dateRange: "",
};

type SettingsObject = typeof DEFAULT_SETTINGS;

function toNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function buildSettings(rows: { key: string; value: string }[]): SettingsObject {
  const raw: Record<string, string> = {};
  for (const row of rows) raw[row.key] = row.value;

  return {
    defaultCountry: raw.defaultCountry ?? DEFAULT_SETTINGS.defaultCountry,
    defaultIndustry: raw.defaultIndustry ?? DEFAULT_SETTINGS.defaultIndustry,
    defaultCity: raw.defaultCity ?? DEFAULT_SETTINGS.defaultCity,
    pageSize: toNumber(raw.pageSize, DEFAULT_SETTINGS.pageSize),
    appendSizeKeywords: toBoolean(
      raw.appendSizeKeywords,
      DEFAULT_SETTINGS.appendSizeKeywords
    ),
    dateRange: raw.dateRange ?? DEFAULT_SETTINGS.dateRange,
  };
}

export async function GET() {
  try {
    await ensureSeeded();
    const rows = await prisma.setting.findMany();
    return NextResponse.json(buildSettings(rows));
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function PUT(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid settings payload" },
        { status: 400 }
      );
    }

    const settings = parsed.data;
    const entries: [string, string][] = [
      ["defaultCountry", settings.defaultCountry],
      ["defaultIndustry", settings.defaultIndustry],
      ["defaultCity", settings.defaultCity],
      ["pageSize", String(settings.pageSize)],
      ["appendSizeKeywords", String(settings.appendSizeKeywords)],
      ["dateRange", settings.dateRange],
    ];

    for (const [key, value] of entries) {
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    const rows = await prisma.setting.findMany();
    return NextResponse.json(buildSettings(rows));
  } catch (error) {
    console.error("PUT /api/settings failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
