import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const originalCwd = process.cwd();
const fixture = mkdtempSync(path.join(tmpdir(), "nvate-tests-"));
let server, origin, render, service, database, templates, auth, uploaded;
const botToken = "test-only-bot-token";
const user = { id: 345678, username: "test_couple" };
const signed = (person = user) => {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify(person),
  });
  const body = [...params]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  params.set(
    "hash",
    crypto.createHmac("sha256", secret).update(body).digest("hex"),
  );
  return params.toString();
};
const request = (url, options = {}) => fetch(origin + url, options);
const jsonPost = (url, form, initData = auth) =>
  request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData, form }),
  });
const form = () => ({
  lang: "ru",
  groomName: "Али",
  brideName: "Зебо",
  weddingDate: "2027-09-19",
  weddingTime: "18:30",
  address: "Навруз, Ташкент",
  mapEnabled: true,
  lat: 41.3111,
  lng: 69.2797,
  templateId: "royal",
  photos: [uploaded],
  musicType: "none",
  musicValue: null,
  guestNames: ["Дильноза", "Азиз"],
  contactTg: "@test_couple",
  phone: "+998 90 123 45 67",
  phone2: "",
});
before(async () => {
  cpSync(path.join(root, "templates"), path.join(fixture, "templates"), {
    recursive: true,
  });
  cpSync(path.join(root, "public"), path.join(fixture, "public"), {
    recursive: true,
  });
  process.chdir(fixture);
  process.env.DEV_NO_AUTH = "0";
  process.env.BOT_TOKEN = botToken;
  process.env.ADMIN_CHAT_IDS = "9999";
  render = await import("../src/render.js");
  service = await import("../src/service.js");
  database = await import("../src/db.js");
  templates = await import("../src/templateStore.js");
  const { createServer } = await import("../src/server.js");
  server = createServer({ onNewApplication: async () => {} }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise((r) => server.once("listening", r));
  origin = `http://127.0.0.1:${server.address().port}`;
  auth = signed();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
    "base64",
  );
  const result = await request("/api/upload", {
    method: "POST",
    headers: {
      "x-init-data": auth,
      "content-type": "application/octet-stream",
    },
    body: png,
  });
  assert.equal(result.status, 200);
  uploaded = (await result.json()).file;
});
after(async () => {
  templates.closeTemplateWatcher();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  database.db.close();
  process.chdir(originalCwd);
  const resolved = path.resolve(fixture);
  assert.ok(
    resolved.startsWith(path.resolve(tmpdir()) + path.sep) &&
      path.basename(resolved).startsWith("nvate-tests-"),
  );
  rmSync(resolved, { recursive: true, force: true });
});

test("catalog exposes five preserved IDs and complete art metadata", async () => {
  const response = await request("/api/config");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(
    data.templates.map((t) => t.id),
    ["royal", "atlas", "bahor", "oqshom", "marsala"],
  );
  for (const tpl of data.templates) {
    assert.ok(tpl.description.ru && tpl.description.uz);
    const asset = await request(tpl.previewImage);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-type"), /^image\//);
  }
});
test("five designs render RU/UZ, personalization, date, photos, map and escaped customer text", () => {
  const evil = "<img src=x onerror=alert(1)>";
  for (const tpl of templates.allTemplates())
    for (const lang of ["ru", "uz"])
      for (const map of [false, true]) {
        const model = {
          ...service.buildPreviewApp({
            ...form(),
            photos: Array(tpl.minPhotos).fill(uploaded),
            templateId: "royal",
          }),
          template_id: tpl.id,
          lang,
          map_enabled: Number(map),
          groom_name: evil,
        };
        const html = render.renderInvitation(model, evil);
        assert.match(html, new RegExp(`data-template="${tpl.id}"`));
        assert.match(html, /id="env"/);
        assert.match(html, /id="cd"/);
        assert.match(html, /id="save-date"/);
        assert.match(html, /2027-09-19T18:30:00\+05:00/);
        assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
        assert.ok(!html.includes(evil));
        assert.ok(!/\{\{[#{\w]/.test(html));
        assert.equal(html.includes("map-widget"), map);
        assert.match(html, new RegExp(`/uploads/${uploaded}`));
      }
});
test("all public demos support new date/time inputs and reduced-motion card mode", async () => {
  for (const tpl of templates.allTemplates()) {
    const response = await request(
      `/demo/${tpl.id}?lang=uz&date=2028-01-12&time=16:45&card=1&groom=Updated`,
    );
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Updated/);
    assert.match(html, /2028-01-12T16:45:00\+05:00/);
    assert.match(html, /prefers-reduced-motion/);
    assert.ok(!html.includes("/demo/sample1.svg"));
  }
});
test("private API routes reject unsigned and tampered identities", async () => {
  assert.equal((await request("/api/my")).status, 401);
  assert.equal((await jsonPost("/api/preview", form(), "")).status, 401);
  assert.equal(
    (
      await jsonPost(
        "/api/applications",
        form(),
        auth.replace("345678", "345679"),
      )
    ).status,
    401,
  );
  assert.equal(
    (await request("/api/upload", { method: "POST", body: "x" })).status,
    401,
  );
  assert.equal(
    (await request("/api/admin/stats", { headers: { "x-init-data": auth } }))
      .status,
    403,
  );
});
test("preview reflects every edit without creating an application", async () => {
  const first = await jsonPost("/api/preview", form());
  assert.equal(first.status, 200);
  assert.match((await first.json()).html, /Али/);
  const second = await jsonPost("/api/preview", {
    ...form(),
    groomName: "Новое имя",
    weddingDate: "2028-02-11",
    weddingTime: "20:15",
    address: "Новый зал",
    mapEnabled: false,
  });
  const { html } = await second.json();
  assert.match(html, /Новое имя/);
  assert.match(html, /Новый зал/);
  assert.match(html, /2028-02-11T20:15:00\+05:00/);
  assert.ok(!html.includes("map-widget"));
  assert.equal(database.listApplicationsByUser(user.id).length, 0);
});
test("validation reports missing names/photos/contacts and missing photo files", async () => {
  for (const changes of [
    { groomName: "" },
    { photos: [] },
    { photos: ["ffffffff-ffff-ffff-ffff-ffffffffffff.jpg"] },
  ]) {
    const response = await jsonPost("/api/preview", { ...form(), ...changes });
    assert.equal(response.status, 400);
    assert.ok((await response.json()).step);
  }
  assert.equal(
    (
      await jsonPost("/api/applications", {
        ...form(),
        phone: "",
        contactTg: "",
      })
    ).status,
    400,
  );
});
test("upload rejects unsupported bytes even with an image content type", async () => {
  const response = await request("/api/upload", {
    method: "POST",
    headers: { "x-init-data": auth, "content-type": "image/png" },
    body: "This is not actually an image.",
  });
  assert.equal(response.status, 400);
});
test("order, server pricing, payment and personalized guest route still work", async () => {
  const response = await jsonPost("/api/applications", {
    ...form(),
    totalPrice: 1,
  });
  assert.equal(response.status, 200);
  const { id } = await response.json();
  const saved = database.getApplication(id);
  assert.equal(saved.total_price, 199000 + 2 * 10000);
  service.payApplication(id, {
    adminId: 9999,
    adminName: "Test administrator",
  });
  const paid = database.getApplication(id);
  assert.equal(paid.status, "paid");
  const result = await request(`/${paid.slug}`);
  assert.equal(result.status, 200);
  const guests = database.listGuests(id);
  assert.equal(guests.length, 2);
  const guestPage = await request(`/${paid.slug}/${guests[0].slug}`);
  assert.match(await guestPage.text(), new RegExp(guests[0].name));
  const mine = await request("/api/my", { headers: { "x-init-data": auth } });
  const list = await mine.json();
  assert.equal(list.apps.length, 1);
  assert.equal(list.apps[0].guests.length, 2);
  const other = await request("/api/my", {
    headers: { "x-init-data": signed({ id: 456789 }) },
  });
  assert.equal((await other.json()).apps.length, 0);
});
