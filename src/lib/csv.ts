/**
 * Minimal RFC-4180 CSV parser/serializer (no external dependency).
 * Handles quoted fields, escaped quotes ("") and CRLF/LF newlines.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1;
      continue;
    }
    if (char === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => escapeCell(cell ?? "")).join(","))
    .join("\r\n");
}

/** Headers used for lead CSV export/import (labels are human-readable). */
export const LEAD_CSV_COLUMNS: { key: string; label: string }[] = [
  { key: "businessName", label: "Business Name" },
  { key: "website", label: "Website" },
  { key: "founderName", label: "Founder/Owner Name" },
  { key: "jobTitle", label: "Job Title" },
  { key: "industry", label: "Industry" },
  { key: "country", label: "Country" },
  { key: "state", label: "State" },
  { key: "city", label: "City" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "linkedinUrl", label: "LinkedIn URL" },
  { key: "sourceUrl", label: "Source URL" },
  { key: "notes", label: "Notes" },
  { key: "tags", label: "Tags" },
  { key: "status", label: "Status" },
];

export const LEAD_CSV_KEYS = LEAD_CSV_COLUMNS.map((c) => c.key);

export function csvHeaderRow(): string[] {
  return LEAD_CSV_COLUMNS.map((c) => c.label);
}

/** Map a parsed CSV table (header + rows) into loose lead objects. */
export function csvRowsToLeads(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const out: Record<string, string>[] = [];

  for (const row of rows.slice(1)) {
    const lead: Record<string, string> = {};
    header.forEach((cell, idx) => {
      const match = LEAD_CSV_COLUMNS.find(
        (col) =>
          col.label.toLowerCase() === cell || col.key.toLowerCase() === cell
      );
      if (match) lead[match.key] = (row[idx] ?? "").trim();
    });
    if (lead.businessName) out.push(lead);
  }
  return out;
}
