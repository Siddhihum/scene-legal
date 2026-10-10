#!/usr/bin/env node
/**
 * Zero-dep consistency checks for Nie Fad legal HTML pages.
 * Run from repo root: node scripts/check-legal-pages.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const pages = [
  "index.html",
  "404.html",
  "impressum/index.html",
  "datenschutz/index.html",
  "konto-loeschen/index.html",
];

const requiredPublicBrand = "Nie Fad";
const forbiddenPublicBrand = /\bScene\b/;
const allowedSceneContexts = [
  /scene-legal/,
  /com\.christianhauer\.path/,
  /Repository heißt weiterhin `scene-legal`/,
];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  }
}

function extractHrefs(html) {
  const hrefs = [];
  const re = /href="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) hrefs.push(m[1]);
  return hrefs;
}

function resolveLocal(fromFile, href) {
  if (/^(mailto:|tel:|https?:|\/\/|#)/i.test(href)) return null;
  const fromDir = path.dirname(path.join(root, fromFile));
  let target = path.resolve(fromDir, href);
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, "index.html");
  }
  if (!path.extname(target) && fs.existsSync(target + ".html")) {
    target = target + ".html";
  }
  return target;
}

for (const rel of pages) {
  const full = path.join(root, rel);
  assert(fs.existsSync(full), `missing page ${rel}`);
  const html = read(rel);
  assert(html.includes('lang="de"'), `${rel}: lang=de`);
  assert(html.includes('name="viewport"'), `${rel}: viewport`);
  assert(html.includes(requiredPublicBrand), `${rel}: brand Nie Fad`);
  assert(html.includes("Impressum"), `${rel}: Impressum link/label`);
  assert(html.includes("Datenschutz"), `${rel}: Datenschutz link/label`);

  // Public-facing "Scene" brand must not remain (technical exceptions allowed).
  const stripped = allowedSceneContexts.reduce(
    (s, re) => s.replace(re, ""),
    html
  );
  assert(!forbiddenPublicBrand.test(stripped), `${rel}: residual public brand "Scene"`);

  for (const href of extractHrefs(html)) {
    const target = resolveLocal(rel, href);
    if (target == null) continue;
    assert(fs.existsSync(target), `${rel}: broken local link ${href} -> ${target}`);
  }
}

const impressum = read("impressum/index.html");
for (const needle of [
  "Christian Hauer",
  "Heinestraße 9/17–18",
  "1020 Wien",
  "christian.hauer1@gmail.com",
  "+43 678 1288913",
  "§&nbsp;5",
  "§&nbsp;25",
  "natürliche Person",
]) {
  assert(impressum.includes(needle), `impressum missing: ${needle}`);
}

const privacy = read("datenschutz/index.html");
for (const needle of [
  "BACKGROUND_LOCATION_ENABLED = false",
  "private_event_images",
  "MapTiler",
  "CARTO",
  "Expo",
  "Supabase",
  "Firebase Cloud Messaging",
  "Österreichische Datenschutzbehörde",
  "signierte URLs",
  "Kontowechsel",
]) {
  assert(privacy.includes(needle), `datenschutz missing: ${needle}`);
}

assert(
  privacy.includes("deaktiviert") && privacy.includes("Hintergrund"),
  "datenschutz must state background location is disabled"
);
assert(
  !/Hintergrundstandortverarbeitung ist optional|Standortzugriff „Immer“/.test(privacy),
  "datenschutz must not claim active optional background location"
);

const deletion = read("konto-loeschen/index.html");
assert(deletion.includes("keine vollständige Selbstbedienungs-Löschung"), "deletion self-service note");
assert(deletion.includes("private Eventbilder"), "deletion mentions private event images");

assert(fs.existsSync(path.join(root, "styles.css")), "styles.css present");
assert(fs.existsSync(path.join(root, ".nojekyll")), ".nojekyll present");

if (process.exitCode) {
  console.error("Legal page checks failed.");
  process.exit(process.exitCode);
}
console.log("✓ scene-legal page consistency checks passed");
