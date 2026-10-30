import { mergeConfig } from "vite";
import path from "node:path";
import base from "./vite.config";

// Isolated optimized build of the actual UI. No application environment files,
// credentials or live services. Profiling React records timings, never props.
export default mergeConfig(base, {
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  resolve: { alias: [{ find: "react-dom/client", replacement: "react-dom/profiling" }] },
  build: { outDir: path.resolve(__dirname, "../../tmp/professional-performance-harness"), emptyOutDir: true, sourcemap: false },
  preview: { host: "127.0.0.1", port: 3101, strictPort: true },
});
