import type esbuild from "esbuild";
import { walk } from "node-os-walk";
import path from "path";
import { Builder } from "./builder";
import { isParsable } from "./utilities/is-parsable";

export type BuildConfig = {
  target: esbuild.BuildOptions["target"];
  srcDir: string;
  outDir: string;
  formats: Array<"commonjs" | "cjs" | "esmodules" | "esm" | "legacy">;
  tsConfig?: string;
  exclude?: RegExp | Array<RegExp>;
  esbuildOptions?: Omit<
    esbuild.BuildOptions,
    | "entryPoints"
    | "outfile"
    | "target"
    | "tsconfig"
    | "bundle"
    | "format"
    | "outExtension"
  >;
};

export async function build(config: BuildConfig) {
  console.log("Building...");

  const builder = new Builder(config.srcDir, config.outDir);

  builder.setFormats(config.formats ?? []);
  builder.target = config.target;
  builder.tsConfig = config.tsConfig;
  builder.additionalESbuildOptions = config.esbuildOptions;

  for await (const [root, _, files] of walk(config.srcDir)) {
    const buildOpList: Promise<any>[] = [];
    for (const file of files) {
      const filePath = path.join(root, file.name);

      if (isParsable(filePath, config.exclude ?? [])) {
        const buildOp = builder.build(filePath);
        buildOpList.push(buildOp);
      }
    }
    await Promise.all(buildOpList);
  }

  console.log("Build complete successfully.");
}
