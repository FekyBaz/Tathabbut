import { defineConfig } from "vite";

// Separate single-entry build for the MV3 content script. Chrome loads
// manifest-declared content scripts as classic scripts, so `content.js`
// must be one self-contained file with no static/dynamic imports and no
// external chunks. The service worker and popup stay ES modules and are
// built by vite.config.ts.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: { content: "src/content.ts" },
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "content.js"
      }
    }
  }
});
