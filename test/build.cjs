const path = require("path");
const { build } = require("../dist/cjs/index.cjs");

async function main() {
  try {
    await build({
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
      isomorphicImports: {
        "./worker-test/get-ext/get-ext.ts": {
          cjs: "./worker-test/get-ext/get-ext.cjs.ts",
          mjs: "./worker-test/get-ext/get-ext.mjs.ts",
          js: "./worker-test/get-ext/get-ext.js.ts",
        },
        "./worker-test/get-workers-dir/get-workers-dir.ts": {
          cjs: "./worker-test/get-workers-dir/get-workers-dir.cjs.ts",
          mjs: "./worker-test/get-workers-dir/get-workers-dir.mjs.ts",
          js: "./worker-test/get-workers-dir/get-workers-dir.js.ts",
        },
      },
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
