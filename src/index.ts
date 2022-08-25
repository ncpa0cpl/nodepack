import type esbuild from "esbuild";
import { walk } from "node-os-walk";
import path from "path";
import { Builder } from "./builder";
import { DeclarationBuilder } from "./declaration-builder";
import { isParsable } from "./utilities/is-parsable";

export type NodePackScriptTarget =
  | "es2022"
  | "es2021"
  | "es2020"
  | "es2019"
  | "es2018"
  | "es2017"
  | "es2016"
  | "es2015"
  | "es5"
  | "es3"
  | "es6"
  | "ESNext";

export type BuildConfig = {
  target: NodePackScriptTarget;
  srcDir: string;
  outDir: string;
  formats: Array<"commonjs" | "cjs" | "esmodules" | "esm" | "legacy">;
  tsConfig?: string;
  exclude?: RegExp | Array<RegExp>;
  declarations?: boolean | "only";
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

  if (config.declarations !== "only") {
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
  }

  if (config.declarations === true || config.declarations === "only") {
    const declarationBuilder = new DeclarationBuilder(
      config.srcDir,
      config.outDir
    );

    if (config.target) {
      declarationBuilder.setTarget(config.target);
    }

    if (config.tsConfig) {
      declarationBuilder.setTsConfig(config.tsConfig);
    }

    await declarationBuilder.build();
  }

  console.log("Build complete successfully.");
}
