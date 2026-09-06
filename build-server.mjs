import * as esbuild from "esbuild";
import { nativeNodePlugin, jsdelivrAlias } from "./esbuild-plugins.mjs";

const banner = "import { createRequire } from 'module';const require = createRequire(import.meta.url);";

for (const [entry, outfile] of [["api/boot.ts", "dist/boot.js"], ["api/worker.ts", "dist/worker.js"]]) {
  await esbuild.build({
    entryPoints: [entry],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile,
    banner: { js: banner },
    plugins: [jsdelivrAlias, nativeNodePlugin("dist")],
  });
  console.log(`bygget ${outfile}`);
}
