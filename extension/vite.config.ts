import { defineConfig } from "vite";
declare const process: { env: Record<string, string | undefined>; cwd(): string };
const buildId = process.env.TATHABBUT_BUILD_ID ?? Date.now().toString(36);
const sourceRoot = process.cwd() + "/src";

export default defineConfig({
  root: sourceRoot,
  define: {
    __TATHABBUT_DIAGNOSTIC_BUILD_ID__: JSON.stringify(`content-${buildId}`)
  },
  build: {
    outDir: process.cwd() + "/dist",
    emptyOutDir: false,
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: sourceRoot + "/popup.html"
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "[name][extname]"
      }
    }
  }
});
