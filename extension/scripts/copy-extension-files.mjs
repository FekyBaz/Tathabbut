import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const extensionRoot = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(extensionRoot, "..");
const dist = resolve(extensionRoot, "dist");
await mkdir(dist, { recursive: true });

const files = [
  [resolve(extensionRoot, "manifest.json"), resolve(dist, "manifest.json")],
  [resolve(extensionRoot, "src/content.css"), resolve(dist, "content.css")],
  [resolve(extensionRoot, "src/popup.html"), resolve(dist, "popup.html")],
  [resolve(repositoryRoot, "README.md"), resolve(dist, "README.md")],
  [resolve(repositoryRoot, "LICENSE"), resolve(dist, "LICENSE")],
  [resolve(repositoryRoot, "docs/MANUAL_TEST.md"), resolve(dist, "docs/MANUAL_TEST.md")],
  [resolve(repositoryRoot, "docs/PRIVACY.md"), resolve(dist, "docs/PRIVACY.md")],
  [resolve(repositoryRoot, "docs/RESPONSIBLE_FILTERING.md"), resolve(dist, "docs/RESPONSIBLE_FILTERING.md")],
  [resolve(repositoryRoot, "docs/THREAT_MODEL.md"), resolve(dist, "docs/THREAT_MODEL.md")]
];
for (const [source, target] of files) {
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}
