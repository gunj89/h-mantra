/* =========================================================
   H MANTRA - one-time Appwrite setup + content migration

   Creates: database, `settings` + `projects` collections, the
   `media` bucket, then uploads
   the current hero + portfolio so the client starts with the
   existing content. Safe to re-run.

   Usage (from this folder):
     npm install
     APPWRITE_PROJECT_ID=... APPWRITE_API_KEY=... node setup.mjs

   Optional: APPWRITE_ENDPOINT (default https://cloud.appwrite.io/v1)
   Flags:    --skip-migrate   --force-migrate   --parse-only
   ========================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Databases, Storage, ID, Query, Permission, Role } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, "..");
const args = new Set(process.argv.slice(2));

/* ---------- read existing portfolio.html ---------- */
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function parsePortfolio() {
    const html = fs.readFileSync(path.join(site, "portfolio.html"), "utf8");
    const re = /<figure class="portfolio-item" data-category="([^"]+)">\s*<a href="([^"]+)" data-caption="([^"]*)">\s*<img[^>]*?width="(\d+)" height="(\d+)"/g;
    const out = [];
    let m;
    while ((m = re.exec(html))) {
        out.push({
            category: m[1].trim().split(/\s+/)[0],
            file: decodeURI(m[2]),
            title: decode(m[3]),
            width: +m[4],
            height: +m[5]
        });
    }
    return out;
}

if (args.has("--parse-only")) {
    const items = parsePortfolio();
    console.log(`Found ${items.length} portfolio items.`);
    const missing = items.filter((i) => !fs.existsSync(path.join(site, i.file)));
    console.log(missing.length ? `Missing files: ${missing.map((i) => i.file).join(", ")}` : "All image files exist.");
    process.exit(missing.length ? 1 : 0);
}

/* ---------- config ---------- */
const need = (k) => {
    if (!process.env[k]) { console.error(`Missing ${k}. See the comment at the top of setup.mjs.`); process.exit(1); }
    return process.env[k];
};
const endpoint = process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = need("APPWRITE_PROJECT_ID");
const apiKey = need("APPWRITE_API_KEY");

const DB = "hmantra", BUCKET = "media", SETTINGS = "settings", PROJECTS = "projects";

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const storage = new Storage(client);

// NO LOGIN: anyone who can reach the API can read AND write. The only "protection"
// is that the admin page address is not linked anywhere. See SETUP.md.
const adminOnly = [
    Permission.read(Role.any()),
    Permission.create(Role.any()),
    Permission.update(Role.any()),
    Permission.delete(Role.any())
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (e) => e && (e.code === 409);
async function ensure(label, fn) {
    try { await fn(); console.log(`  + ${label}`); }
    catch (e) { if (exists(e)) console.log(`  = ${label} (already exists)`); else throw e; }
}

async function waitForAttributes(collection) {
    for (let i = 0; i < 60; i++) {
        const { attributes } = await databases.listAttributes(DB, collection);
        if (attributes.every((a) => a.status === "available")) return;
        if (attributes.some((a) => a.status === "failed")) throw new Error(`An attribute failed in ${collection}`);
        await sleep(1000);
    }
    throw new Error(`Timed out waiting for ${collection} attributes`);
}

/* ---------- 1. schema ---------- */
console.log("Creating database, collections and bucket...");
await ensure("database", async () => {
    // free plans allow a single database, so check first instead of blindly creating
    try { await databases.get(DB); }
    catch (e) {
        if (e.code !== 404) throw e;
        await databases.create(DB, "H Mantra");
        return;
    }
    throw Object.assign(new Error("exists"), { code: 409 });
});

await ensure("collection settings", () => databases.createCollection(DB, SETTINGS, "Site settings", adminOnly, false));
await ensure("settings.heroType", () => databases.createStringAttribute(DB, SETTINGS, "heroType", 16, false, "image"));
await ensure("settings.heroFileId", () => databases.createStringAttribute(DB, SETTINGS, "heroFileId", 64, false));
await ensure("settings.heroPosterId", () => databases.createStringAttribute(DB, SETTINGS, "heroPosterId", 64, false));

await ensure("collection projects", () => databases.createCollection(DB, PROJECTS, "Portfolio projects", adminOnly, false));
await ensure("projects.title", () => databases.createStringAttribute(DB, PROJECTS, "title", 120, true));
await ensure("projects.category", () => databases.createStringAttribute(DB, PROJECTS, "category", 40, true));
await ensure("projects.fileId", () => databases.createStringAttribute(DB, PROJECTS, "fileId", 64, true));
await ensure("projects.width", () => databases.createIntegerAttribute(DB, PROJECTS, "width", false));
await ensure("projects.height", () => databases.createIntegerAttribute(DB, PROJECTS, "height", false));
await ensure("projects.order", () => databases.createIntegerAttribute(DB, PROJECTS, "order", true));
await ensure("projects.visible", () => databases.createBooleanAttribute(DB, PROJECTS, "visible", false, true));
await databases.updateCollection(DB, SETTINGS, "Site settings", adminOnly, false);
await databases.updateCollection(DB, PROJECTS, "Portfolio projects", adminOnly, false);
await waitForAttributes(SETTINGS);
await waitForAttributes(PROJECTS);

const exts = ["jpg", "jpeg", "png", "webp", "mp4", "webm", "mov"];
await ensure("bucket media", async () => {
    try { await storage.createBucket(BUCKET, "Site media", adminOnly, false, true, 100_000_000, exts); }
    catch (e) {
        if (exists(e)) throw e;
        // plan may cap file size (free plan: 50,000,000 bytes)
        console.log(`    (100 MB bucket refused: ${e.message}; retrying with 50 MB)`);
        await storage.createBucket(BUCKET, "Site media", adminOnly, false, true, 50_000_000, exts);
    }
});

await storage.updateBucket(BUCKET, "Site media", adminOnly, false, true);

/* ---------- 2. (no admin user: the admin page has no login) ---------- */

/* ---------- 3. migrate current content ---------- */
if (!args.has("--skip-migrate")) {
    console.log("Migrating current hero + portfolio...");
    const existing = await databases.listDocuments(DB, PROJECTS, [Query.limit(1)]);
    if (existing.total > 0 && !args.has("--force-migrate")) {
        console.log(`  = projects already has ${existing.total} entries, skipping (use --force-migrate to add again)`);
    } else {
        const items = parsePortfolio();
        let n = 0;
        for (const [i, it] of items.entries()) {
            const full = path.join(site, it.file);
            if (!fs.existsSync(full)) { console.log(`  ! missing ${it.file}, skipped`); continue; }
            const f = await storage.createFile(BUCKET, ID.unique(), InputFile.fromPath(full, path.basename(full)));
            await databases.createDocument(DB, PROJECTS, ID.unique(), {
                title: it.title, category: it.category, fileId: f.$id,
                width: it.width, height: it.height, order: i, visible: true
            });
            n++;
            process.stdout.write(`\r  uploaded ${n}/${items.length}`);
        }
        console.log(`\n  + ${n} portfolio items`);
    }

    let hasHero = true;
    try { await databases.getDocument(DB, SETTINGS, "main"); } catch { hasHero = false; }
    if (!hasHero) {
        const heroPath = path.join(site, "assets/images/hero.jpg");
        const f = await storage.createFile(BUCKET, ID.unique(), InputFile.fromPath(heroPath, "hero.jpg"));
        await databases.createDocument(DB, SETTINGS, "main", { heroType: "image", heroFileId: f.$id });
        console.log("  + hero image");
    } else console.log("  = hero already set");
}

/* ---------- 4. write config.js ---------- */
const cfgPath = path.join(site, "assets/js/config.js");
fs.writeFileSync(cfgPath, `/* Appwrite connection settings (public values only - never put an API key here).
   Leave projectId empty and the website simply shows its built-in static content.
   \`node setup/setup.mjs\` fills this file in for you. */
window.HM_CONFIG = ${JSON.stringify({
    endpoint, projectId, databaseId: DB, bucketId: BUCKET,
    settingsCollectionId: SETTINGS, projectsCollectionId: PROJECTS
}, null, 4)};
`);
console.log(`\nWrote ${path.relative(process.cwd(), cfgPath)}`);
console.log(`
Done. Last manual step (Appwrite blocks unknown websites):
  Console -> your project -> Overview -> Integrations -> Add platform -> Web
  Add your live domain (e.g. hmantra.com and www.hmantra.com) and "localhost" for testing.
Then open /admin.html on the site. It has no login, so keep that address private.`);
