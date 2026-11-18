import { defineConfig } from "vite";
declare const process: { env: Record<string, string | undefined> };
const buildId = process.env.TATHABBUT_BUILD_ID ?? Date.now().toString(36);

// Separate single-entry build for the MV3 content script. Chrome loads
// manifest-declared content scripts as classic scripts, so `content.js`
// must be one self-contained file with no static/dynamic imports and no
// external chunks. The popup stays an ES module and is built separately.
export default defineConfig({
  // This identifies a content-script build in local diagnostics. It is not
  // evidence that a browser instance has loaded that build.
  define: {
    __TATHABBUT_DIAGNOSTIC_BUILD_ID__: JSON.stringify(`content-${buildId}`)
  },
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
