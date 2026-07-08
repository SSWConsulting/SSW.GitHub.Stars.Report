import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For GitHub Pages project site at your-org.github.io/<repo>, set base to "/<repo>/".
// Override via BASE_PATH env in CI so this file stays repo-agnostic.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
});
