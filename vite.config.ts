import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: { pawnshop: "index.html", nightWatch: "night-watch.html" },
    },
  },
});
