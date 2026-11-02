import { defineConfig } from "vitest/config";

// Next reads the "@/*" path from tsconfig.json but vitest doesn't, so mirror it here.
// Absolute path so "@/" doesn't resolve relative to the importing file.
export default defineConfig({
    test: {
        alias: {
            "@/": new URL("./", import.meta.url).pathname
        }
    }
});
