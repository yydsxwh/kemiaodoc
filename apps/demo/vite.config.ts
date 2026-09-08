import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@kemiaodoc/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "@kemiaodoc/docx": path.resolve(__dirname, "../../packages/docx/src/index.ts"),
      "@kemiaodoc/editor": path.resolve(__dirname, "../../packages/editor/src/index.ts"),
      "@kemiaodoc/editor/styles.css": path.resolve(__dirname, "../../packages/editor/src/styles.css"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
})
