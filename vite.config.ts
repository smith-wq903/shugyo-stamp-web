import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/shugyo-stamp-web/",
  server: {
    host: "0.0.0.0",
  },
});
