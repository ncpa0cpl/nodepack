import type esbuild from "esbuild";
import { Program } from "./program";
import { ensureAbsolutePath } from "./utilities/ensure-absolute-path";

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
  decoratorsMetadata?: boolean;
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
  let program: Program | undefined = undefined;

  try {
    console.log("Building...");

    ensureAbsolutePath(config.srcDir);
    ensureAbsolutePath(config.outDir);
    if (config.tsConfig) {
      ensureAbsolutePath(config.tsConfig);
    }

    program = new Program(config);

    const ops: Promise<void>[] = [];

    if (config.declarations !== "only") {
      ops.push(program.transpileSource());
    }

    if (config.declarations === true || config.declarations === "only") {
      ops.push(program.emitDeclarations());
    }

    await Promise.all(ops);

    console.log("Build completed successfully.");
  } finally {
    program?.close();
  }
}
