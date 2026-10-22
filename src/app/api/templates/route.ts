import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_TEMPLATES } from "@/lib/templates";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category");
  
  const now = new Date().toISOString();
  
  let items = SYSTEM_TEMPLATES.map((t, i) => ({
    id: `sys-${i}`,
    name: t.name,
    description: t.description || "",
    category: t.category,
    template: t.template,
    engine: t.engine,
    sources: t.sources ?? [],
    isSystem: true,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  }));
  
  if (category) {
    items = items.filter((t) => t.category === category);
  }
  
  items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  
  return NextResponse.json({ items });
}

export async function POST() {
  return NextResponse.json({ error: "Not supported in read-only mode" }, { status: 405 });
}
