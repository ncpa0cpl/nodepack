// @ts-ignore
import { toTsType } from "dilswer";
import fs from "fs/promises";
import path from "path";
import url from "url";
import { build } from "../src/index";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const p = (...args) => path.resolve(__dirname, "..", ...args);

async function buildConfigTypes() {
  const { buildConfigSchema } = await import(p("dist/cjs/build-config.cjs"));

  const ts = toTsType(buildConfigSchema, {
    declaration: true,
    exports: "named",
    mode: "named-expanded",
    getExternalTypeImport(type) {
      const meta = type.meta.get();

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
      "./workers/get-ext": {
        cjs: "./workers/get-ext/get-ext.cts",
        mjs: "./workers/get-ext/get-ext.mts",
        js: "./workers/get-ext/get-ext.ts",
      },
      "./workers/get-workers-dir": {
        mjs: "./workers/get-workers-dir/get-workers-dir.ts",
        cjs: "./workers/get-workers-dir/get-workers-dir.cts",
        js: "./workers/get-workers-dir/get-workers-dir.cts",
      },
      "./get-nodepack-dir": {
        mjs: "./get-nodepack-dir/get-nodepack-dir.ts",
        cjs: "./get-nodepack-dir/get-nodepack-dir.cts",
        js: "./get-nodepack-dir/get-nodepack-dir.cts",
      },
    },
  });

  await buildConfigTypes();
}

main();
