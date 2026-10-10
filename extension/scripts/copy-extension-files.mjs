import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "..");
const dist = resolve(root, "dist");
await mkdir(dist, { recursive: true });

for (const [source, target] of [
  ["manifest.json", "manifest.json"],
  ["src/content.css", "content.css"],
  ["src/popup.html", "popup.html"]
]) {
  await copyFile(resolve(root, source), resolve(dist, target));
}
