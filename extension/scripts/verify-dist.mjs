import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const dist = resolve(scriptDirectory, "..", "dist");

const failures = [];

function fail(message) {
  failures.push(message);
  console.error("verify-dist: FAIL: " + message);
}

async function read(name) {
  try {
    return await readFile(resolve(dist, name), "utf8");
  } catch {
    fail("missing file: " + name);
    return null;
  }
}

// Static `import`/`export` statements and dynamic `import()` are a
// SyntaxError in a classic MV3 content script. The bundled output must
// also not reach out to external chunk files at runtime.
function assertClassicScript(name, source) {
  if (/(?:^|[;{}])\s*import[\s({*"]/.test(source)) {
    fail(name + " contains a static import statement; it cannot load as a classic content script.");
  }
  if (/\bimport\s*\(/.test(source)) {
    fail(name + " contains a dynamic import(); it cannot load as a classic content script.");
  }
  if (source.includes("chunks/")) {
    fail(name + " references external chunk files at runtime; it must be self-contained.");
  }
  if (/(?:^|[;{}])\s*export[\s{*]/.test(source)) {
    fail(name + " contains an export statement; it cannot load as a classic content script.");
  }
}

const manifestRaw = await read("manifest.json");
if (manifestRaw) {
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch {
    fail("manifest.json is not valid JSON.");
  }
  if (manifest) {
    if (manifest.manifest_version !== 3) fail("manifest_version must be 3.");
    const scripts = manifest.content_scripts ?? [];
    for (const entry of scripts) {
      for (const file of [...(entry.js ?? []), ...(entry.css ?? [])]) {
        const source = await read(file);
        if (source && file.endsWith(".js")) assertClassicScript(file, source);
      }
    }
    const background = manifest.background?.service_worker;
    if (!background) {
      fail("background.service_worker is missing.");
    } else if (!(await read(background))) {
      fail("background service worker file is missing: " + background);
    }
    const popup = manifest.action?.default_popup;
    if (popup && !(await read(popup))) fail("popup file is missing: " + popup);
  }
}

if (failures.length > 0) {
  console.error("verify-dist: " + failures.length + " problem(s) in dist/.");
  process.exit(1);
}
console.log("verify-dist: dist/ is a valid installable MV3 package.");
