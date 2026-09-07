import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig, type PluginOption } from "vite"

// https://vite.dev/config/
export default defineConfig(async ({ command }) => {
  const plugins: PluginOption[] = [
    devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }),
  ]
  // Kun i dev: inspeksjonsattributter for React-komponenter (aldri i prod-bundle).
  if (command === "serve") {
    const { inspectAttr } = await import("kimi-plugin-inspect-react")
    plugins.push(inspectAttr())
  }
  plugins.push(react())

  return {
    plugins,
    server: {
      port: 3000,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@contracts": path.resolve(__dirname, "./contracts"),
        "@db": path.resolve(__dirname, "./db"),
        "db": path.resolve(__dirname, "./db"),
      },
    },
    envDir: path.resolve(__dirname),
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
      // OTA-192: stabile leverandør-chunks slik at app-endringer ikke invaliderer dem.
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined
            if (/node_modules\/(react|react-dom|react-router|scheduler|@tanstack|@trpc|superjson|clsx|tailwind-merge|class-variance-authority)\//.test(id)) return "react-vendor"
            if (id.includes("node_modules/lucide-react/")) return "icons"
            if (id.includes("node_modules/luxon/")) return "luxon"
            if (id.includes("node_modules/@radix-ui/")) return "radix"
            if (/node_modules\/(recharts|d3-|victory-|internmap|delaunator|robust-predicates)/.test(id)) return "recharts"
            if (id.includes("node_modules/@stripe/")) return "stripe"
            if (/node_modules\/(motion|framer-motion|motion-dom|motion-utils)\//.test(id)) return "motion"
            return undefined
          },
        },
      },
    },
  }
});
