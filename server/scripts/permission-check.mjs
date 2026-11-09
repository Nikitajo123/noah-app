// Permission checks against a running local server with the seeded demo data.
// Usage: npm run check:permissions   (server must run on localhost:3000, data from `npx prisma db seed`)
// Optional env: API_URL (default http://localhost:3000/api), DEMO_PASSWORD (default noah123).
// Never point this at the live site: it creates and deletes test records.

const BASE = process.env.API_URL ?? "http://localhost:3000/api";
const PASSWORD = process.env.DEMO_PASSWORD ?? "noah123";

const results = [];

async function call(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function login(email) {
  const r = await call(null, "POST", "/auth/login", { email, password: PASSWORD });
  if (r.status !== 200) {
    console.error(`Prijava ${email} ni uspela (${r.status}). Ali si zagnal seed in strežnik?`);
    process.exit(2);
  }
  return r.data.token;
}

// Runs one request and compares the status. `extra(data)` may return an error string.
async function check(name, token, method, path, body, expected, extra) {
  let ok = false;
  let detail = "";
  let res = { status: 0, data: null };
  try {
    res = await call(token, method, path, body);
    ok = res.status === expected;
    detail = `${res.status}`;
    if (ok && extra) {
      const problem = extra(res.data);
      if (problem) {
        ok = false;
        detail += `, ${problem}`;
      }
    }
  } catch (e) {
    detail = String(e);
  }
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (pričakovano ${expected}, dobljeno ${detail})`);
  return res;
}

const today = new Date().toLocaleDateString("sv-SE");

const admin = await login("janez@noah.si");
const vg = await login("vodja.gradbisc@noah.si");
const vd = await login("vodja.del@noah.si");
const worker = await login("marko@noah.si");

const projects = (await call(admin, "GET", "/projects")).data;
const byName = (n) => projects.find((p) => p.name === n);
const novak = byName("Hiša Novak");
const muller = byName("Hiša Müller");
const kovac = byName("Hiša Kovač");
if (!novak || !muller || !kovac) {
  console.error("Manjkajo seed gradbišča (Hiša Novak, Hiša Müller, Hiša Kovač).");
  process.exit(2);
}
const allOrders = (await call(admin, "GET", "/work-orders")).data;
const kovacOrder = allOrders.find((o) => o.project.id === kovac.id);
const workers = (await call(admin, "GET", "/workers")).data;
const luka = workers.find((w) => w.name.startsWith("Luka"));
const marko = workers.find((w) => w.name.startsWith("Marko"));
const managers = (await call(admin, "GET", "/workers/managers")).data;
const vdUser = managers.find((m) => m.role === "VODJA_DEL");
const users = (await call(admin, "GET", "/users")).data;
const adminUser = users.find((u) => u.email === "janez@noah.si");

const noKovac = (list) =>
  Array.isArray(list) && list.some((x) => (x.project?.id ?? x.id) === kovac.id) ? "vidi Hišo Kovač" : "";

console.log("\nDelavec: brez dostopa do poti vodje");
for (const [m, p] of [
  ["GET", "/projects"],
  ["GET", "/overview"],
  ["GET", "/users"],
  ["GET", "/workers"],
  ["GET", "/project-hours"],
  ["GET", "/reports/day"],
  ["GET", "/team-reports/day"],
  ["GET", "/teams"],
]) {
  await check(`delavec ${m} ${p}`, worker, m, p, undefined, 403);
}
await check("delavec ustvari nalog", worker, "POST", "/work-orders", { projectId: novak.id }, 403);
await check("delavec ustvari gradbišče", worker, "POST", "/projects", { name: "x", location: "y" }, 403);
if (kovacOrder) {
  await check("delavec izbriše nalog", worker, "DELETE", `/work-orders/${kovacOrder.id}`, undefined, 403);
}

console.log("\nVodja del");
await check("vodja del vidi samo svoja gradbišča", vd, "GET", "/projects", undefined, 200, (d) =>
  noKovac(d) || (d.length === 1 && d[0].id === novak.id ? "" : `vidi ${d.length} gradbišč`)
);
await check("vodja del ne vidi Hiše Kovač", vd, "GET", `/projects/${kovac.id}`, undefined, 404);
if (kovacOrder) {
  await check("vodja del ne vidi naloga v Hiši Kovač", vd, "GET", `/work-orders/${kovacOrder.id}`, undefined, 404);
}
await check("vodja del: seznam nalogov brez Hiše Kovač", vd, "GET", "/work-orders", undefined, 200, noKovac);
await check("vodja del: pregled brez Hiše Kovač", vd, "GET", "/overview", undefined, 200, noKovac);
await check("vodja del ne more ustvariti gradbišča", vd, "POST", "/projects", { name: "Test", location: "X" }, 403);
await check("vodja del ne more urejati gradbišča", vd, "PATCH", `/projects/${novak.id}`, { name: "X", location: "Y" }, 403);
await check("vodja del ne more dodeliti vodij", vd, "PUT", `/projects/${novak.id}/managers`, { role: "VODJA_DEL", userIds: [] }, 403);
await check("vodja del ne more ustvariti uporabnika", vd, "POST", "/users", {}, 403);
await check("vodja del ne more urejati ekip", vd, "POST", "/teams", {}, 403);
await check("vodja del lahko dobi seznam delavcev", vd, "GET", "/workers", undefined, 200);
await check("vodja del lahko dobi seznam vodij", vd, "GET", "/workers/managers", undefined, 200);
await check("vodja del ne more ustvariti naloga v Hiši Kovač", vd, "POST", "/work-orders", {
  projectId: kovac.id,
  workerIds: [luka.id],
  description: "Test",
  dueDate: today,
}, 403);
const created = await check("vodja del ustvari nalog v Hiši Novak", vd, "POST", "/work-orders", {
  projectId: novak.id,
  workerIds: [marko.id],
  description: "Test pravic (izbriše se sam)",
  dueDate: today,
  materials: ["vijaki"],
}, 201);
const testOrderId = created.data?.id;
if (testOrderId) {
  await check("vodja del zamenja delavca na svojem nalogu", vd, "PUT", `/work-orders/${testOrderId}/workers`, { workerIds: [luka.id] }, 200);
  await check("vodja del doda opombo", vd, "POST", `/work-orders/${testOrderId}/notes`, { text: "Test opomba" }, 201);
  await check("vodja del ne more izbrisati naloga", vd, "DELETE", `/work-orders/${testOrderId}`, undefined, 403);

  console.log("\nUredi nalog (vodja del, Hiša Novak)");
  const detail = (await call(vd, "GET", `/work-orders/${testOrderId}`)).data;
  const screw = detail.materials.find((m) => m.name === "vijaki");
  await check("vodja del uredi opis, rok in material", vd, "PATCH", `/work-orders/${testOrderId}`, {
    description: "Test pravic, urejeno",
    dueDate: today,
    plannedHours: 3,
    materials: [{ id: screw.id, name: "vijaki 6 mm" }, { name: "lepilo" }],
  }, 200, (d) => (d.changes?.length >= 3 ? "" : "spremembe niso zapisane"));
  await check("sprememba je zapisana v zgodovini", vd, "GET", `/work-orders/${testOrderId}`, undefined, 200, (d) =>
    d.edits.length >= 2 ? "" : `samo ${d.edits.length} zapisov`
  );
  await check("vodja del ne more prestaviti naloga v Hišo Kovač", vd, "PATCH", `/work-orders/${testOrderId}`, { projectId: kovac.id }, 403);
  await check("vodja gradbišč prestavi nalog v Hišo Müller", vg, "PATCH", `/work-orders/${testOrderId}`, { projectId: muller.id }, 200);
  await check("vodja del zdaj ne vidi naloga (Müller ni njegov)", vd, "GET", `/work-orders/${testOrderId}`, undefined, 404);
  await check("vodja gradbišč vrne nalog v Hišo Novak", vg, "PATCH", `/work-orders/${testOrderId}`, { projectId: novak.id }, 200);
  if (kovacOrder) {
    await check("vodja del ne more urejati naloga v Hiši Kovač", vd, "PATCH", `/work-orders/${kovacOrder.id}`, { description: "x" }, 404);
    await check("vodja gradbišč ne more zaključiti naloga v Hiši Kovač", vg, "POST", `/work-orders/${kovacOrder.id}/close`, undefined, 404);
  }
  await check("delavec ne more urejati naloga", worker, "PATCH", `/work-orders/${testOrderId}`, { description: "x" }, 403);

  console.log("\nDnevno stanje in zaščita podatkov");
  const lukaToken = await login("luka@noah.si");
  await check("delavec (Luka) ne vidi zgodovine sprememb", lukaToken, "GET", `/work-orders/${testOrderId}`, undefined, 200, (d) =>
    d.edits.length === 0 ? "" : "vidi spremembe"
  );
  await check("stanje pred začetkom naloga ni mogoče", lukaToken, "PATCH", `/work-orders/${testOrderId}/day-status`, { done: false, note: "x" }, 400);
  await check("Luka začne nalog", lukaToken, "PATCH", `/work-orders/${testOrderId}/status`, { status: "V_DELU" }, 200);
  await check("NE brez razloga ni dovoljen", lukaToken, "PATCH", `/work-orders/${testOrderId}/day-status`, { done: false }, 400);
  await check("Luka vnese NE z razlogom", lukaToken, "PATCH", `/work-orders/${testOrderId}/day-status`, { done: false, note: "Manjka material" }, 200);
  await check("Marko (ni na nalogu) ne more vnesti stanja", worker, "PATCH", `/work-orders/${testOrderId}/day-status`, { done: true }, 404);
  await check("vodja ne more vnesti stanja namesto delavca", vd, "PATCH", `/work-orders/${testOrderId}/day-status`, { done: true }, 403);
  await check("Luka začne delo", lukaToken, "POST", "/time/start", { workOrderId: testOrderId }, 201);
  await check("DA med delom ni mogoč", lukaToken, "PATCH", `/work-orders/${testOrderId}/day-status`, { done: true }, 400);
  await check("vodja ne more zaključiti, ko delo poteka", vd, "POST", `/work-orders/${testOrderId}/close`, undefined, 400);
  await check("Luka konča delo", lukaToken, "POST", "/time/end", {}, 200);
  await check("delavca z urami ni mogoče odstraniti", vd, "PATCH", `/work-orders/${testOrderId}`, { workerIds: [marko.id] }, 400);
  const glue = (await call(vd, "GET", `/work-orders/${testOrderId}`)).data.materials.find((m) => m.name === "lepilo");
  await check("Luka vnese porabo materiala", lukaToken, "PATCH", `/materials/${glue.id}`, { usedQty: 2 }, 200);
  await check("materiala s porabo ni mogoče odstraniti", vd, "PATCH", `/work-orders/${testOrderId}`, {
    materials: (await call(vd, "GET", `/work-orders/${testOrderId}`)).data.materials
      .filter((m) => m.id !== glue.id)
      .map((m) => ({ id: m.id, name: m.name })),
  }, 400);
  await check("Luka DA zaključi nalog", lukaToken, "PATCH", `/work-orders/${testOrderId}/day-status`, { done: true }, 200, (d) =>
    d.closed ? "" : "nalog se ni zaključil"
  );
  await check("delavec ne more ponovno odpreti prek poti vodje", lukaToken, "POST", `/work-orders/${testOrderId}/reopen`, undefined, 403);
  await check("vodja del ponovno odpre nalog", vd, "POST", `/work-orders/${testOrderId}/reopen`, undefined, 200);
  await check("vodja del zaključi nalog", vd, "POST", `/work-orders/${testOrderId}/close`, undefined, 200);
  await check("vodja del uredi zaključen nalog", vd, "PATCH", `/work-orders/${testOrderId}`, { plannedHours: 4 }, 200);
  await check("nalog ostane zaključen po urejanju", lukaToken, "GET", `/work-orders/${testOrderId}`, undefined, 200, (d) =>
    d.status === "ZAKLJUCEN" ? "" : `status ${d.status}`
  );
}
await check("vodja del: ure po gradbiščih", vd, "GET", "/project-hours", undefined, 200, (d) =>
  d.projects.some((p) => p.projectId === kovac.id) ? "vidi Hišo Kovač" : ""
);

console.log("\nVodja gradbišč");
await check("vodja gradbišč vidi Novak in Müller", vg, "GET", "/projects", undefined, 200, (d) =>
  noKovac(d) || (d.length === 2 ? "" : `vidi ${d.length} gradbišč`)
);
await check("vodja gradbišč ne more dodeliti vodje del v Hiši Kovač", vg, "PUT", `/projects/${kovac.id}/managers`, { role: "VODJA_DEL", userIds: [vdUser.id] }, 403);
await check("vodja gradbišč ne more dodeliti vodje gradbišč", vg, "PUT", `/projects/${muller.id}/managers`, { role: "VODJA_GRADBISC", userIds: [] }, 403);
await check("vodja gradbišč dodeli vodjo del v Hiši Müller", vg, "PUT", `/projects/${muller.id}/managers`, { role: "VODJA_DEL", userIds: [vdUser.id] }, 200);
await check("vodja del zdaj vidi Hišo Müller", vd, "GET", `/projects/${muller.id}`, undefined, 200);
await check("vodja gradbišč odstrani vodjo del iz Hiše Müller", vg, "PUT", `/projects/${muller.id}/managers`, { role: "VODJA_DEL", userIds: [] }, 200);
await check("vodja del spet ne vidi Hiše Müller", vd, "GET", `/projects/${muller.id}`, undefined, 404);
const vgProject = await check("vodja gradbišč ustvari gradbišče", vg, "POST", "/projects", { name: "Test gradbišče (izbriše se samo)", location: "Test" }, 201);
const vgProjectId = vgProject.data?.id;
if (vgProjectId) {
  await check("novo gradbišče je samodejno dodeljeno vodji gradbišč", vg, "GET", `/projects/${vgProjectId}`, undefined, 200);
  await check("vodja gradbišč uredi svoje gradbišče", vg, "PATCH", `/projects/${vgProjectId}`, { name: "Test gradbišče 2", location: "Test" }, 200);
  await check("vodja gradbišč ne more izbrisati gradbišča", vg, "DELETE", `/projects/${vgProjectId}`, undefined, 403);
}
await check("vodja gradbišč ne more urejati Hiše Kovač", vg, "PATCH", `/projects/${kovac.id}`, { name: "X", location: "Y" }, 403);
if (kovacOrder) {
  await check("vodja gradbišč ne vidi naloga v Hiši Kovač", vg, "GET", `/work-orders/${kovacOrder.id}`, undefined, 404);
  await check("vodja gradbišč ne more dodati opombe v Hiši Kovač", vg, "POST", `/work-orders/${kovacOrder.id}/notes`, { text: "x" }, 404);
}
await check("vodja gradbišč ne vidi uporabnikov", vg, "GET", "/users", undefined, 403);
await check("vodja gradbišč ne more ustvariti uporabnika", vg, "POST", "/users", {}, 403);
await check("vodja gradbišč ne more spremeniti vloge", vg, "PATCH", `/users/${vdUser.id}/role`, { role: "DELAVEC" }, 403);
await check("vodja gradbišč ne more urejati ekip", vg, "GET", "/teams", undefined, 403);
await check("vodja gradbišč: dnevna poročila", vg, "GET", "/reports/day", undefined, 200);
await check("vodja gradbišč: poročila ekip", vg, "GET", "/team-reports/day", undefined, 200);

console.log("\nAdmin");
await check("admin vidi vsa gradbišča", admin, "GET", "/projects", undefined, 200, (d) =>
  d.some((p) => p.id === kovac.id) ? "" : "ne vidi Hiše Kovač"
);
await check("admin: ustvarjanje uporabnika gre čez preverjanje pravic (400 = napačni podatki)", admin, "POST", "/users", {}, 400);
await check("admin ne more spremeniti svoje vloge", admin, "PATCH", `/users/${adminUser.id}/role`, { role: "DELAVEC" }, 400);
await check("admin ureja ekipe", admin, "GET", "/teams", undefined, 200);
await check("admin ne more izbrisati gradbišča z nalogi", admin, "DELETE", `/projects/${novak.id}`, undefined, 409);
if (testOrderId) {
  await check("admin izbriše testni nalog", admin, "DELETE", `/work-orders/${testOrderId}`, undefined, 200);
}
if (vgProjectId) {
  await check("admin izbriše prazno testno gradbišče", admin, "DELETE", `/projects/${vgProjectId}`, undefined, 200);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed} od ${results.length} preverjanj uspešnih${passed === results.length ? "" : ", NAPAKE ZGORAJ"}`);
process.exit(passed === results.length ? 0 : 1);
