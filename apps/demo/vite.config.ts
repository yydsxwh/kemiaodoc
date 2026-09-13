import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@kemiaodoc/editor/styles.css",
        replacement: path.resolve(__dirname, "../../packages/editor/src/styles.css"),
      },
      {
        find: "@kemiaodoc/core",
        replacement: path.resolve(__dirname, "../../packages/core/src/index.ts"),
      },
      {
        find: "@kemiaodoc/docx",
        replacement: path.resolve(__dirname, "../../packages/docx/src/index.ts"),
      },
      {
        find: "@kemiaodoc/editor",
        replacement: path.resolve(__dirname, "../../packages/editor/src/index.ts"),
      },
    ],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
})
