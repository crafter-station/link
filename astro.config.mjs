import { defineConfig } from "astro/config"

export default defineConfig({
  site: "https://link.crafter.run",
  output: "static",
  build: { format: "directory" },
  devToolbar: { enabled: false },
})
