// Appen er selvstendig i apps/mobile. Metro skal bare løse pakker herfra –
// aldri fra rotens node_modules, der nettet har egne (og andre) versjoner av
// React og venner. Rotens node_modules blokkeres derfor eksplisitt. Koden i
// appen importerer heller ikke noe fra api/ eller db/; delte kontrakttyper
// hentes kun med `import type` og forsvinner i bygget.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const repoNodeModules = path.resolve(__dirname, "../../node_modules");
const escaped = repoNodeModules.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
config.resolver.blockList = [...[].concat(config.resolver.blockList ?? []), new RegExp(`^${escaped}/.*`)];

module.exports = config;
