import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes built asset paths relative, so the same build works on
// Vercel and on a GitHub Pages project site. Change to "/" if you host at a root.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
