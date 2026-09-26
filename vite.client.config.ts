import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
    root: "src/client",
    publicDir: "../../assets",
    plugins: [react()],
    build: {
        outDir: "../../dist/client",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                index: resolve(import.meta.dirname, "src/client/index.html"),
                map: resolve(import.meta.dirname, "src/client/map.html"),
            },
        },
    },
});
