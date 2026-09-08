import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig, type PluginOption } from "vite"

/**
 * Forhåndslaster de to latinske skriftfilene.
 *
 * Skriftene ligger bak et CSS-importtre, så nettleseren oppdager dem først
 * etter at stilarket er lastet og tolket. Overskriften på forsiden er
 * sidens største element, og den ble tegnet to ganger: én gang i
 * reserveskriften og én gang i Newsreader. Med preload kommer filene i gang
 * med én gang, og det siste opptegnet skjer tidligere.
 *
 * Bare de rene latinske filene forhåndslastes. latin-ext dekker tegn norsk
 * ikke bruker, og 88 kB til ville konkurrert med den kritiske stien.
 *
 * Filnavnene er innholdshashet, så lenken settes inn når bygget er ferdig og
 * navnene faktisk finnes.
 */
function preloadLatinFonts(): PluginOption {
  return {
    name: "hellosky-preload-latin-fonts",
    apply: "build",
    enforce: "post",
    async writeBundle(options, bundle) {
      const dir = options.dir
      if (!dir) return
      const links = Object.keys(bundle)
        .filter((f) => /(manrope|newsreader)-latin-(?!ext-)[^/]*\.woff2$/.test(f))
        .map((f) => `<link rel="preload" href="/${f}" as="font" type="font/woff2" crossorigin>`)
        .join("\n    ")
      if (!links) return
      const fs = await import("node:fs/promises")
      const file = path.join(dir, "index.html")
      const html = await fs.readFile(file, "utf8")
      if (html.includes('rel="preload"')) return
      await fs.writeFile(file, html.replace("</head>", `  ${links}\n  </head>`))
    },
  }
}

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
  plugins.push(preloadLatinFonts())

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
            // Delte CJS-interop-hjelpere hører hjemme i basischunken. Havner de i
            // en leverandør-chunk, importerer react-vendor fra den chunken, og da
            // kan den kjøre før React er initialisert («undefined.useLayoutEffect»).
            if (id.includes("commonjsHelpers") || id.includes("\u0000commonjs")) return "react-vendor"
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
