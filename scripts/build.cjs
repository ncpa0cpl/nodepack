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
  isomorphicImports: {
    "./workers/get-ext/get-ext.ts": {
      cjs: "./workers/get-ext/get-ext.cjs.ts",
      mjs: "./workers/get-ext/get-ext.mjs.ts",
      js: "./workers/get-ext/get-ext.js.ts",
    },
    "./workers/get-workers-dir/get-workers-dir.ts": {
      cjs: "./workers/get-workers-dir/get-workers-dir.cjs.ts",
      mjs: "./workers/get-workers-dir/get-workers-dir.mjs.ts",
      js: "./workers/get-workers-dir/get-workers-dir.js.ts",
    },
  },
});
