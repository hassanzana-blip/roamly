import fs from "fs";
import path from "path";

// Pakk @node-rs/argon2 inkl. native .node-binær inn i bygget:
// 1. .node-filer som finnes på disken kopieres til dist/native og lastes
//    via require.resolve (fungerer i både CJS- og ESM-kontekst)
// 2. .node-filer for andre plattformer erstattes med en stub som kaster
//    en tydelig feil (de kan uansett aldri lastes på denne arkitekturen)
// 3. jsDelivr-URL-er (fallback-nedlasting i napi-rs) erstattes med lokal require
//
// Delt register på tvers av bundles (boot.js + worker.js deler dist/native).
function registry() {
  globalThis.__roamlyNativeCopies ??= new Map();
  return globalThis.__roamlyNativeCopies;
}

export function nativeNodePlugin(outdir) {
  return {
    name: "native-node",
    setup(build) {
      // Fang alle .node-filer som standard resolve har slått opp til en
      // faktisk filsti (gjelder også pakke-referanser som
      // '@node-rs/argon2-linux-x64-gnu' hvis 'main' peker på .node-filen).
      build.onLoad({ filter: /\.node$/ }, (args) => {
        if (fs.existsSync(args.path)) {
          const copies = registry();
          if (!copies.has(args.path)) {
            copies.set(args.path, `${path.basename(args.path, ".node")}-${copies.size}.node`);
          }
          const name = copies.get(args.path);
          return {
            contents: `import { createRequire as __cr } from "module"; const __req = __cr(import.meta.url); export default __req.resolve("./native/${name}");`,
            loader: "js",
          };
        }
        return {
          contents: `throw new Error(${JSON.stringify(`Native modul ${args.path} er ikke tilgjengelig for denne plattformen`)});`,
          loader: "js",
        };
      });
      build.onEnd(() => {
        fs.mkdirSync(path.join(outdir, "native"), { recursive: true });
        const copies = registry();
        for (const [src, name] of copies) {
          const dest = path.join(outdir, "native", name);
          if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
        }
        console.log(`[native-node] totalt ${copies.size} native filer i ${outdir}/native`);
      });
    },
  };
}

export const jsdelivrAlias = {
  name: "jsdelivr-alias",
  setup(build) {
    build.onResolve({ filter: /^https:\/\// }, (args) => ({
      path: path.join(path.dirname(args.importer), args.path.split("/").pop()),
    }));
  },
};
