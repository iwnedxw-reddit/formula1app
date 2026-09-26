import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
    build: {
        emptyOutDir: false,
        ssr: resolve(__dirname, "src/server/index.ts"),
        outDir: "dist/server",
        target: "node22",
        sourcemap: true,
        rollupOptions: {
            external: [...builtinModules, ...builtinModules.map((mod) => `node:${mod}`)],
            output: {
                format: "cjs",
                entryFileNames: "index.cjs",
                inlineDynamicImports: true,
                exports: "named",
            },
        },
    },
    ssr: {
        noExternal: true,
    },
});
