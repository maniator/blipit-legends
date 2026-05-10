import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, type ViteUserConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  root: "src",
  publicDir: path.resolve(__dirname, "public"),
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.split(path.sep).join("/");
          if (
            normalizedId.includes("/node_modules/react/") ||
            normalizedId.includes("/node_modules/react-dom/") ||
            normalizedId.includes("/node_modules/react-is/")
          ) {
            return "react-vendor";
          }
          if (
            normalizedId.includes("/node_modules/rxdb/") ||
            normalizedId.includes("/node_modules/dexie/") ||
            normalizedId.includes("/node_modules/rxjs/") ||
            normalizedId.includes("/node_modules/mingo/")
          ) {
            return "rxdb-vendor";
          }
          if (normalizedId.includes("/node_modules/styled-components/")) {
            return "styled-vendor";
          }
          if (normalizedId.includes("/node_modules/@dnd-kit/")) {
            return "dnd-vendor";
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@storage": path.resolve(__dirname, "src/storage"),
      "@test": path.resolve(__dirname, "src/test"),
      "@feat": path.resolve(__dirname, "src/features"),
      "@feat/leagues": path.resolve(__dirname, "src/features/leagues"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? mode),
    __IS_VERCEL_BUILD__: JSON.stringify(process.env.VERCEL === "1"),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: ".",
      filename: "sw.ts",
      injectRegister: false,
      manifest: false,
      injectManifest: {
        rollupFormat: "es",
        globPatterns: ["**/*.{js,css,html,woff2}", "images/**", "manifest.webmanifest"],
      },
    }),
  ] as ViteUserConfig["plugins"],
  test: {
    // vmForks creates an isolated V8 VM context per test file, torn down after
    // each file completes. This allows the GC to reclaim RxDB / fake-indexeddb
    // memory between files and prevents heap accumulation across the 145-file
    // suite (the default "forks" pool retains module caches between files in the
    // same worker process, causing 4-6 GB heap growth on CI).
    pool: "vmForks",
    // happy-dom is a lightweight DOM implementation that is significantly
    // faster and uses less memory than jsdom. It also makes window.location
    // fully configurable, which prevents the "Cannot redefine property:
    // location" errors that occur in jsdom when using the vmForks pool.
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./test/react-global.ts", "./test/setup.ts"],
    coverage: {
      provider: "v8",
      // Patterns are relative to the vitest root, which is "src/" (set by
      // `root: "src"` above).  Do NOT prefix with "src/" — that would look
      // for src/src/** which never exists.
      include: ["**/*.{ts,tsx}"],
      exclude: [
        "index.tsx",
        "sw.ts",
        "test/**",
        "**/*.test.{ts,tsx}",
        "../e2e/**",
        "../playwright.config.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90,
      },
    },
  },
}));
