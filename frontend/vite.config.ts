import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"
import istanbul from "vite-plugin-istanbul"

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "127.0.0.1",
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    // Istanbul instrumentation for E2E coverage - enabled via VITE_COVERAGE env
    istanbul({
      include: "src/**/*",
      exclude: [
        "node_modules/**",
        "tests/**",
        "src/client/**",
        "src/routeTree.gen.ts",
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
      ],
      extension: [".ts", ".tsx"],
      requireEnv: true,
      checkProd: false,
    }),
  ],
  build: {
    sourcemap: true,
  },
})
