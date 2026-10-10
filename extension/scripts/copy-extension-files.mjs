import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");
await mkdir(dist, { recursive: true });

for (const [source, target] of [
  ["manifest.json", "manifest.json"],
  ["src/content.css", "content.css"]
]) {
  await copyFile(resolve(root, source), resolve(dist, target));
}
