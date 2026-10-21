const base = "http://localhost:3111";

let passed = 0;
let failed = 0;

async function call(method, path, body) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    if (body instanceof FormData) {
      init.body = body;
    } else {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  }
  const res = await fetch(base + path, init);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json, text };
}

function check(label, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${label} -> ${JSON.stringify(detail).slice(0, 300)}`);
  }
}

const SETTINGS_DEFAULTS = {
  defaultCountry: "USA",
  defaultIndustry: "",
  defaultCity: "",
  pageSize: 20,
  appendSizeKeywords: false,
  dateRange: "",
};

async function sweep() {
  const leads = await call("GET", "/api/leads?pageSize=200");
  for (const lead of leads.body?.items ?? []) {
    await call("DELETE", `/api/leads/${lead.id}`);
  }
  const lists = await call("GET", "/api/lists");
  for (const list of lists.body?.items ?? []) {
    await call("DELETE", `/api/lists/${list.id}`);
  }
  await call("DELETE", "/api/searches?scope=all");
  const templates = await call("GET", "/api/templates?favorite=true");
  for (const tpl of templates.body?.items ?? []) {
    await call("PUT", `/api/templates/${tpl.id}`, { isFavorite: false });
  }
  await call("PUT", "/api/settings", SETTINGS_DEFAULTS);
}

async function main() {
  await sweep();

  for (const page of ["/", "/search", "/leads", "/templates", "/history", "/favorites", "/settings"]) {
    const r = await call("GET", page);
    check(`page ${page} -> 200`, r.status === 200, { status: r.status });
  }

  const templates = await call("GET", "/api/templates");
  check(
    "GET /api/templates returns 65 templates",
    templates.status === 200 && templates.body.items?.length === 65,
    { status: templates.status, count: templates.body.items?.length }
  );

  const settings = await call("GET", "/api/settings");
  check(
    "GET /api/settings returns defaults",
    settings.status === 200 && settings.body.defaultCountry === "USA",
    settings
  );

  const stats0 = await call("GET", "/api/stats");
  check("GET /api/stats", stats0.status === 200 && typeof stats0.body.totalLeads === "number", stats0);

  const leadA = await call("POST", "/api/leads", {
    businessName: "Smoke Test Cafe",
    website: "https://smoketest.example",
    industry: "Cafe",
    country: "USA",
    city: "Austin",
    state: "TX",
    status: "New",
    tags: "smoke,test",
  });
  check("POST /api/leads -> 201", leadA.status === 201, leadA);
  const leadId = leadA.body?.id;

  const dup = await call("POST", "/api/leads", {
    businessName: "Smoke Test Cafe",
    website: "https://smoketest.example",
  });
  check("duplicate POST -> 409", dup.status === 409, dup);

  const forced = await call("POST", "/api/leads", {
    businessName: "Smoke Test Cafe Two",
    website: "https://smoketest2.example",
    force: true,
  });
  check("second lead -> 201", forced.status === 201, forced);
  const leadId2 = forced.body?.id;

  const list1 = await call("GET", "/api/leads?page=1&pageSize=20");
  check("GET /api/leads total=2", list1.status === 200 && list1.body.total === 2, list1.body);

  const fav = await call("PUT", `/api/leads/${leadId}`, { favorite: true });
  check("PUT favorite", fav.status === 200 && fav.body.favorite === true, fav);

  const favList = await call("GET", "/api/leads?favorite=true");
  check("GET favorite=true -> 1", favList.body?.total === 1, favList.body);

  const filtered = await call("GET", "/api/leads?status=New&country=USA&sort=businessName&order=asc");
  check("GET filtered leads", filtered.status === 200 && filtered.body.total === 1, filtered.body);

  const patched = await call("PUT", `/api/leads/${leadId}`, { status: "Contacted" });
  check("PUT status", patched.status === 200 && patched.body.status === "Contacted", patched);

  const bulk = await call("PATCH", "/api/leads/bulk", {
    ids: [leadId, leadId2],
    action: "setStatus",
    status: "Qualified",
  });
  check("PATCH bulk status", bulk.status === 200 && bulk.body.count === 2, bulk);

  const createdList = await call("POST", "/api/lists", { name: "Smoke List" });
  check("POST /api/lists -> 201", createdList.status === 201, createdList);

  const addToList = await call("PATCH", "/api/leads/bulk", {
    ids: [leadId, leadId2],
    action: "addToList",
    listId: createdList.body?.id,
  });
  check("bulk addToList", addToList.status === 200 && addToList.body.count === 2, addToList);

  const byList = await call("GET", `/api/leads?listId=${createdList.body?.id}`);
  check("GET leads by list -> 2", byList.body?.total === 2, byList.body);

  const csv = await call("GET", "/api/leads/export");
  check(
    "GET export CSV",
    csv.status === 200 && csv.text.includes("Business Name") && csv.text.includes("Smoke Test Cafe"),
    { status: csv.status, head: csv.text.slice(0, 80) }
  );

  const form = new FormData();
  form.append(
    "file",
    new File(
      ["Business Name,City\nImported Bakery,Dallas\n,Missing Name\n"],
      "leads.csv",
      { type: "text/csv" }
    )
  );
  form.append("skipDuplicates", "true");
  const imported = await call("POST", "/api/leads/import", form);
  check(
    "POST import CSV -> imported=1 invalid=1",
    imported.status === 200 && imported.body.imported === 1 && imported.body.invalid === 1,
    imported
  );

  const logged = await call("POST", "/api/searches", {
    query: 'Cafe owners in Austin ("Owner" OR "Founder")',
    engine: "google",
    label: "Smoke search",
    filters: {},
  });
  check("POST /api/searches", logged.status === 200 || logged.status === 201, logged);

  const saved = await call("POST", "/api/searches/save", {
    queries: ["smoke query one", "smoke query two"],
    engine: "google",
    label: "Smoke batch",
    category: null,
    filters: {},
  });
  check(
    "POST save -> count 2",
    (saved.status === 200 || saved.status === 201) && saved.body.count === 2,
    saved
  );

  const history = await call("GET", "/api/searches?limit=20");
  check("GET history >= 3", history.body?.items?.length >= 3, history.body);

  const tplFav = await call("PUT", `/api/templates/${templates.body.items[0].id}`, {
    isFavorite: true,
  });
  check("PUT template favorite", tplFav.status === 200 && tplFav.body.isFavorite === true, tplFav);

  const favTemplates = await call("GET", "/api/templates?favorite=true");
  check("GET favorite templates -> 1", favTemplates.body?.items?.length === 1, favTemplates.body);

  const bad = await call("GET", "/api/leads?page=0");
  check("invalid query -> 400", bad.status === 400, bad);

  const missing = await call("GET", "/api/leads/nonexistent-id");
  check("missing lead -> 404", missing.status === 404, missing);

  const saveSettings = await call("PUT", "/api/settings", {
    defaultCountry: "Australia",
    defaultIndustry: "Gym",
    defaultCity: "Sydney",
    pageSize: 50,
    appendSizeKeywords: true,
    dateRange: "week",
  });
  check("PUT /api/settings", saveSettings.status === 200, saveSettings);

  const settings2 = await call("GET", "/api/settings");
  check(
    "settings persisted",
    settings2.body?.defaultCountry === "Australia" && settings2.body?.pageSize === 50,
    settings2.body
  );

  const stats1 = await call("GET", "/api/stats");
  check(
    "stats reflect 3 leads",
    stats1.body?.totalLeads === 3,
    stats1.body
  );

  await sweep();

  const finalLeads = await call("GET", "/api/leads");
  const finalTemplates = await call("GET", "/api/templates?favorite=true");
  const finalHistory = await call("GET", "/api/searches");
  const finalLists = await call("GET", "/api/lists");
  const finalSettings = await call("GET", "/api/settings");
  check(
    "cleanup complete",
    finalLeads.body?.total === 0 &&
      finalTemplates.body?.items?.length === 0 &&
      finalHistory.body?.items?.length === 0 &&
      finalLists.body?.items?.length === 0 &&
      finalSettings.body?.defaultCountry === "USA",
    {
      leads: finalLeads.body?.total,
      favT: finalTemplates.body?.items?.length,
      hist: finalHistory.body?.items?.length,
      lists: finalLists.body?.items?.length,
      country: finalSettings.body?.defaultCountry,
    }
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("SMOKE_CRASH", e);
  process.exit(1);
});
