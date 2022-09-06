// @ts-ignore
const path = require("path");
const { build } = require("../node_modules/@ncpa0cpl/nodepack");

build({
  target: "es2020",
  srcDir: path.resolve(__dirname, "../src"),
  outDir: path.resolve(__dirname, "../dist"),
  formats: ["cjs", "esm", "legacy"],
  tsConfig: path.resolve(__dirname, "../tsconfig.json"),
  declarations: true,
  extMapping: {
    ".js": ".js",
    ".mjs": ".mjs",
    ".cjs": ".cjs",
  },
});
