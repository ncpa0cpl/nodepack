import type esbuild from "esbuild";
import { walk } from "node-os-walk";
import path from "path";
import { Builder } from "./builder";
import { DeclarationBuilder } from "./declaration-builder";
import { DeclarationPathRewriter } from "./declaration-path-rewriter";
import { ensureAbsolutePath } from "./utilities/ensure-absolute-path";
import { ExcludeFacade } from "./utilities/exclude-facade";
import { isParsable } from "./utilities/is-parsable";
import { PathAliasResolver } from "./utilities/path-alias-resolver";

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
  /**
   * Allows to customize the file extension of the generated
   * files.
   */
  extMapping?: Record<`.${string}`, `.${string}` | "%FORMAT%">;
  /**
   * A map of path aliases.
   *
   * Each path alias must end with a `/*`, and each alias value
   * must be a path relative to the `srcDir`, start with a `./`
   * and end with a `/*`.
   *
   * @example
   *   build({
   *     // ...
   *     pathAliases: {
   *       "@Utils/*": "./Utils/*",
   *     },
   *   });
   */
  pathAliases?: Record<`${string}/*`, `./${string}/*` | "./*">;
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

    const pathAliases = new PathAliasResolver(config.pathAliases);
    const exclude = new ExcludeFacade(config.exclude ?? []);

    if (config.declarations !== "only") {
      console.log("Building JavaScript files.");

      const builder = new Builder(config.srcDir, config.outDir);

      builder.setFormats(config.formats ?? []);
      builder.target = config.target;
      builder.tsConfig = config.tsConfig;
      builder.additionalESbuildOptions = config.esbuildOptions;
      builder.pathAliases = pathAliases;

      if (config.extMapping) builder.setOutExtensions(config.extMapping);

      const buildOpList: Promise<any>[] = [];
      for await (const [root, _, files] of walk(config.srcDir)) {
        for (const file of files) {
          const filePath = path.join(root, file.name);

          if (
            exclude.isNotExcluded(filePath) &&
            (isParsable(filePath) ||
              builder.extMapper.hasMapping(path.extname(filePath)))
          ) {
            const buildOp = builder.build(filePath);
            buildOpList.push(buildOp);
          }
        }
      }
      await Promise.all(buildOpList);
    }

    if (config.declarations === true || config.declarations === "only") {
      console.log("Creating declaration files.");

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

      if (config.pathAliases) {
        const declarationPathRewriter = new DeclarationPathRewriter(
          declarationBuilder.outDir,
          pathAliases
        );

        declarationPathRewriter.rewrite();
      }
    }

    console.log("Build completed successfully.");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
