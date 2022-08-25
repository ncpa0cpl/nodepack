import type esbuild from "esbuild";
import { walk } from "node-os-walk";
import path from "path";
import { Builder } from "./builder";
import { DeclarationBuilder } from "./declaration-builder";
import { ensureAbsolutePath } from "./utilities/ensure-absolute-path";
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
  /** Target environment for the generated JavaScript. */
  target: NodePackScriptTarget;
  /** Absolute path to the directory containing the source files. */
  srcDir: string;
  /**
   * Absolute path to the directory to which the compiled source
   * should be outputted to.
   */
  outDir: string;
  /**
   * List of format types that should be outputted.
   *
   * - `cjs` format - CommonJS module format with a .cjs file
   *   extension.
   * - `esm` format - ES module format with a .mjs file extension.
   * - `legacy` format - CommonJS module format with a .js file
   *   extension.
   */
  formats: Array<"commonjs" | "cjs" | "esmodules" | "esm" | "legacy">;
  /** Absolute path to the TypeScript config file. */
  tsConfig?: string;
  /** Regex patterns used to exclude files from compilation. */
  exclude?: RegExp | Array<RegExp>;
  /**
   * Indicates if typescript declarations are to be generated. If
   * set to true, `.d.ts` files will be generated along the
   * JavaScript files, if set to `only` no JavaScript will be
   * emitted, only the declarations.
   *
   * To be able to generate declarations, TypeScript packages
   * must be installed.
   */
  declarations?: boolean | "only";
  /** Options to pass to the `esbuild` compiler. */
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
  try {
    console.log("Building...");

    ensureAbsolutePath(config.srcDir);
    ensureAbsolutePath(config.outDir);
    if (config.tsConfig) {
      ensureAbsolutePath(config.tsConfig);
    }

    if (config.declarations !== "only") {
      const builder = new Builder(config.srcDir, config.outDir);

      builder.setFormats(config.formats ?? []);
      builder.target = config.target;
      builder.tsConfig = config.tsConfig;
      builder.additionalESbuildOptions = config.esbuildOptions;

      const buildOpList: Promise<any>[] = [];
      for await (const [root, _, files] of walk(config.srcDir)) {
        for (const file of files) {
          const filePath = path.join(root, file.name);

          if (isParsable(filePath, config.exclude ?? [])) {
            const buildOp = builder.build(filePath);
            buildOpList.push(buildOp);
          }
        }
      }
      await Promise.all(buildOpList);
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
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
