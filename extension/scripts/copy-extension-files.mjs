import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
await mkdir(dist, { recursive: true });

for (const file of ["manifest.json", "src/content.css"]) {
  const destination = resolve(dist, file === "manifest.json" ? "manifest.json" : "content.css");
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(root, file), destination);
}
