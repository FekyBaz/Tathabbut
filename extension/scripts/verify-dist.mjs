import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const dist = resolve(scriptDirectory, "..", "dist");
const failures = [];
const expectedFiles = new Set([
  "LICENSE",
  "README.md",
  "content.css",
  "content.js",
  "manifest.json",
  "popup.html",
  "popup.js",
  "docs/MANUAL_TEST.md",
  "docs/PRIVACY.md",
  "docs/RESPONSIBLE_FILTERING.md",
  "docs/THREAT_MODEL.md"
]);

function fail(message) {
  failures.push(message);
  console.error("verify-dist: FAIL: " + message);
}

async function read(name) {
  try {
    return await readFile(join(dist, name), "utf8");
  } catch {
    fail("missing file: " + name);
    return null;
  }
}

async function listFiles(directory, prefix = "") {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isDirectory()) output.push(...await listFiles(join(directory, entry.name), relative));
    else if (entry.isFile()) output.push(relative);
    else fail("unsupported package entry: " + relative);
  }
  return output;
}

function assertClassicScript(name, source) {
  if (/(?:^|[;{}])\s*import[\s({*"]/m.test(source)) fail(name + " contains a static import statement.");
  if (/\bimport\s*\(/.test(source)) fail(name + " contains a dynamic import().");
  if (source.includes("chunks/")) fail(name + " references external chunks.");
  if (/(?:^|[;{}])\s*export[\s{*]/m.test(source)) fail(name + " contains an export statement.");
}

const files = (await listFiles(dist)).sort();
for (const file of expectedFiles) if (!files.includes(file)) fail("required release file missing: " + file);
for (const file of files) if (!expectedFiles.has(file)) fail("unexpected release file: " + file);

const manifestRaw = await read("manifest.json");
const contentSource = await read("content.js");
const popupSource = await read("popup.js");
const popupHtml = await read("popup.html");
if (contentSource && !/buildId\s*:\s*["']content-[a-z0-9]+["']/.test(contentSource)) {
  fail("content.js is missing its generated diagnostic build identifier.");
}
if (contentSource) assertClassicScript("content.js", contentSource);
if (manifestRaw) {
  let manifest;
  try { manifest = JSON.parse(manifestRaw); }
  catch { fail("manifest.json is not valid JSON."); }
  if (manifest) {
    if (manifest.manifest_version !== 3) fail("manifest_version must be 3.");
    if (JSON.stringify(manifest.permissions ?? []) !== JSON.stringify(["storage"])) {
      fail("permissions must be exactly [\"storage\"].");
    }
    if (manifest.optional_permissions !== undefined) fail("optional_permissions are not permitted in the local release.");
    if (manifest.optional_host_permissions !== undefined) fail("optional_host_permissions are not permitted in the local release.");
    if (manifest.background !== undefined) fail("a background service worker is not needed in the local release.");
    const expectedHosts = ["https://*.facebook.com/*", "https://facebook.com/*"];
    const hostPermissions = [...(manifest.host_permissions ?? [])].sort();
    if (JSON.stringify(hostPermissions) !== JSON.stringify([...expectedHosts].sort())) {
      fail("host_permissions must contain only the two Facebook host patterns.");
    }
    const scripts = manifest.content_scripts ?? [];
    for (const entry of scripts) {
      for (const file of [...(entry.js ?? []), ...(entry.css ?? [])]) {
        if (!expectedFiles.has(file)) fail("content script references an unlisted package file: " + file);
      }
    }
    const matches = scripts.flatMap((entry) => entry.matches ?? []);
    if (JSON.stringify([...matches].sort()) !== JSON.stringify([...expectedHosts].sort())) {
      fail("content script matches must be limited to the Facebook host allowlist.");
    }
    if (manifest.action?.default_popup !== "popup.html") fail("popup.html must be the action popup.");
  }
}
if (popupHtml && /id=["']apiUrl["']|\/v1\/classify|self-hosted API/i.test(popupHtml)) {
  fail("popup.html contains remote API configuration or instructions.");
}
for (const [name, source] of [["content.js", contentSource], ["popup.js", popupSource]]) {
  if (!source) continue;
  for (const [pattern, label] of [
    [/tathabbut:classify-remote/, "remote classification messaging"],
    [/\/v1\/classify/, "remote classification endpoint"],
    [/\bfetch\s*\(/, "network fetch"],
    [/XMLHttpRequest|WebSocket|sendBeacon/, "network transport"],
    [/chrome\.runtime\.sendMessage/, "runtime message transport"],
    [/chrome\.permissions\.request/, "optional permission request"]
  ]) if (pattern.test(source)) fail(name + " contains forbidden " + label + ".");
}

if (failures.length > 0) {
  console.error("verify-dist: " + failures.length + " problem(s) in dist/.");
  process.exit(1);
}
console.log("verify-dist: local-only MV3 package, permissions, and file inventory are valid.");
console.log("verify-dist inventory: " + files.join(", "));
