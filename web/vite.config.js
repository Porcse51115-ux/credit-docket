import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes built asset paths relative, so the same build works on
// Vercel and on a GitHub Pages project site. Change to "/" if you host at a root.
//
// server.fs.allow: ".." lets the dev server read the shared statute registry at
// ../src/law/*.json (the single source of truth both projects import). The build
// bundles it regardless; this is only for `npm run dev`.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { fs: { allow: [".."] } },
});
