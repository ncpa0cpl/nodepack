const path = require("path");
const { build } = require("../dist/cjs/index.cjs");

build({
  target: "es2020",
  srcDir: path.resolve(__dirname, "src"),
  outDir: path.resolve(__dirname, "dist"),
  formats: ["cjs", "esm", "legacy"],
  declarations: true,
  tsConfig: path.resolve(__dirname, "tsconfig.json"),
  decoratorsMetadata: true,
  esbuildOptions: {
    loader: { ".data": "base64", ".custom": "json" },
  },
  extMapping: {
    ".custom": "%FORMAT%",
    ".js": ".js",
    ".mjs": ".mjs",
    ".cjs": ".cjs",
  },
  pathAliases: {
    "@Root/*": "./*",
  },
});
