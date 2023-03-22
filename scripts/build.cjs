// @ts-ignore
const path = require("path");
const { toTsType, getMetadata } = require("dilswer");
const { build } = require("../node_modules/@ncpa0cpl/nodepack");
const fs = require("fs/promises");

const p = (...args) => path.resolve(__dirname, "..", ...args);

async function buildConfigTypes() {
  const { buildConfigSchema } = require(p("dist/cjs/build-config.cjs"));

  const ts = toTsType(buildConfigSchema, {
    declaration: true,
    exports: "named",
    mode: "named-expanded",
    getExternalTypeImport(type) {
      const meta = getMetadata(type);

      if (meta.extra?.type) {
        if (meta.extra.importFrom) {
          return {
            typeName: meta.extra.type,
            path: meta.extra.importFrom,
          };
        }
        return {
          typeName: meta.extra.type,
        };
      }
    },
  });

  await fs.writeFile(p("dist/types/build-config-type.d.ts"), ts);
}

async function main() {
  await build({
    target: "es2020",
    srcDir: p("src"),
    outDir: p("dist"),
    formats: ["cjs", "esm", "legacy"],
    tsConfig: p("tsconfig.json"),
    declarations: true,
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
      "./get-nodepack-dir/get-nodepack-dir.ts": {
        js: "./get-nodepack-dir/get-nodepack-dir.cjs.ts",
        cjs: "./get-nodepack-dir/get-nodepack-dir.cjs.ts",
        mjs: "./get-nodepack-dir/get-nodepack-dir.mjs.ts",
      },
    },
  });

  await buildConfigTypes();
}

main();
