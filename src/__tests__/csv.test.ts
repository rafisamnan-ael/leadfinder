import { describe, expect, it } from "vitest";
import {
  LEAD_CSV_KEYS,
  csvHeaderRow,
  csvRowsToLeads,
  parseCsv,
  toCsv,
} from "@/lib/csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('name,city\n"Acme, Inc",Austin')).toEqual([
      ["name", "city"],
      ["Acme, Inc", "Austin"],
    ]);
  });

  it("unescapes doubled quotes", () => {
    expect(parseCsv('a\n"He said ""hi"""')).toEqual([
      ["a"],
      ['He said "hi"'],
    ]);
  });

  it("keeps newlines inside quoted fields", () => {
    expect(parseCsv('notes\n"line1\nline2"')).toEqual([
      ["notes"],
      ["line1\nline2"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("toCsv", () => {
  it("quotes cells containing commas, quotes, or newlines", () => {
    const out = toCsv([["a,b", 'say "hi"', "line1\nline2"]]);
    expect(out).toBe('"a,b","say ""hi""","line1\nline2"');
  });

  it("leaves plain cells unquoted", () => {
    expect(toCsv([["a", "b"]])).toBe("a,b");
  });

  it("round-trips through parseCsv", () => {
    const rows = [
      ["Business Name", "Notes"],
      ["Acme, Inc", 'He said "no"\nthen left'],
      ["Plain", ""],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("lead CSV mapping", () => {
  it("exposes a header row matching the export columns", () => {
    const header = csvHeaderRow();
    expect(header).toHaveLength(LEAD_CSV_KEYS.length);
    expect(header[0]).toBe("Business Name");
    expect(header).toContain("LinkedIn URL");
  });

  it("maps label headers and lower-case keys to lead fields", () => {
    const header = csvHeaderRow();
    const leads = csvRowsToLeads([
      header,
      ["Acme", "https://acme.com", "Jane", "", "Bakery", "USA", "TX", "Austin"],
    ]);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      businessName: "Acme",
      website: "https://acme.com",
      founderName: "Jane",
      industry: "Bakery",
      country: "USA",
      state: "TX",
      city: "Austin",
    });
  });

  it("accepts key headers (businessname) case-insensitively", () => {
    const leads = csvRowsToLeads([
      ["businessname", "city"],
      ["Acme", "Austin"],
    ]);
    expect(leads[0]).toEqual({ businessName: "Acme", city: "Austin" });
  });

  it("skips rows without a business name", () => {
    const leads = csvRowsToLeads([
      ["Business Name", "City"],
      ["", "Austin"],
      ["Acme", "Dallas"],
    ]);
    expect(leads).toHaveLength(1);
    expect(leads[0].businessName).toBe("Acme");
  });

  it("returns nothing for header-only or empty input", () => {
    expect(csvRowsToLeads([["Business Name"]])).toEqual([]);
    expect(csvRowsToLeads([])).toEqual([]);
  });
});
