import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// base: "./" makes built asset paths relative, so the same build works on
// Vercel and on a GitHub Pages project site. Change to "/" if you host at a root.
//
// server.fs.allow: ".." lets the dev server read the shared statute registry at
// ../src/law/*.json (the single source of truth both projects import). The build
// bundles it regardless; this is only for `npm run dev`.
//
// resolve.alias: "@" -> "src" is the shadcn/ui convention so component imports
// like `import { Button } from "@/components/ui/button"` work cleanly.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { fs: { allow: [".."] } },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
