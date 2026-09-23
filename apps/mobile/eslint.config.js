// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", ".expo/*"] },
  {
    // Node-skript (ikoner, buntsjekk) og konfigurasjon kjøres i Node, ikke i appen.
    files: ["scripts/**/*.{js,cjs,mjs}", "*.config.js"],
    languageOptions: { globals: { __dirname: "readonly", require: "readonly", module: "writable", process: "readonly", console: "readonly" } },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Ingen logging i appen: tokens og persondata skal aldri havne i enhetens logg.
      "no-console": "error",
      // Kontrakttyper deles med serveren – de skal aldri bli en runtime-import av serverkode.
      "@typescript-eslint/consistent-type-imports": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["**/api/**", "**/db/**", "@db/*"], message: "Appen importerer aldri serverkode." },
            { group: ["@react-native-async-storage/*"], message: "Tokens og persondata lagres kun i SecureStore." },
          ],
        },
      ],
    },
  },
]);
