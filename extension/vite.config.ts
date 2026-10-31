import { defineConfig } from "vite";

export default defineConfig({
  define: {
    __TATHABBUT_DIAGNOSTIC_BUILD_ID__: JSON.stringify(`content-${Date.now().toString(36)}`)
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        background: "src/background.ts",
        popup: "src/popup.html"
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "[name][extname]"
      }
    }
  }
});
