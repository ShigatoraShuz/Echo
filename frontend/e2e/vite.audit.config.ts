import { mergeConfig } from "vite";
import path from "node:path";
import base from "./vite.config";
export default mergeConfig(base, {
  root: path.resolve(__dirname, "audit"),
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  resolve: { alias: [
    ...["@/services/calendar/calendar-api", "@/services/journal/journal-service.factory", "@/services/professionals/professional-api"].map(find => ({ find, replacement: path.resolve(__dirname, "audit/services.ts") })),
  ] },
  build: { outDir: path.resolve(__dirname, "../../tmp/repository-audit/runtime"), emptyOutDir: false, sourcemap: false },
  preview: { host: "127.0.0.1", port: 3104, strictPort: true },
});
