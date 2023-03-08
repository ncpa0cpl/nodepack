import { createValidatedFunction, DataType } from "dilswer";
import type esbuild from "esbuild";
import path from "node:path";

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
   * Wether to generate metadata along with the typescript
   * decorators, this requires to transpile files first with a
   * TypeScript compiler before compiling with esbuild and will
   * make the build process noticeably slower.
   */
  decoratorsMetadata?: boolean;
  /** Options to pass to the `esbuild` compiler. */
  esbuildOptions?: Omit<
    esbuild.BuildOptions,
    | "entryPoints"
    | "outfile"
    | "outdir"
    | "outbase"
    | "target"
    | "tsconfig"
    | "bundle"
    | "format"
    | "outExtension"
    | "absWorkingDir"
    | "watch"
  >;
  /** Regex patterns used to exclude files from compilation. */
  exclude?: RegExp | Array<RegExp>;
  /**
   * Allows to customize the file extension of the outputted
   * files.
   */
  extMapping?: Record<`.${string}`, `.${string}` | "%FORMAT%">;
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
  /**
   * Files that should get their imports replaced to other path,
   * depending on the extension for which it is compiled.
   *
   * All path provided should be relative to the `srcDir`.
   *
   * If no import is defined for a format, the import will be
   * left as is.
   *
   * Since some of the features in Node are only available for
   * ESModules or CommonJS modules (for example `__filename` or
   * `import.meta`), it might be helpful to have different file
   * be imported depending on which module type the program is
   * using.
   *
   * To define a different index file for each of the compiled
   * formats:
   *
   * @example
   *   build({
   *     // ...
   *     isomorphicImports: {
   *       "./index.ts": {
   *         mjs: "./index.esm.ts",
   *         cjs: "./index.cjs.ts",
   *         js: "./index.legacy.ts",
   *       },
   *     },
   *   });
   */
  isomorphicImports?: Record<
    `./${string}`,
    {
      cjs?: `./${string}`;
      mjs?: `./${string}`;
      js?: `./${string}`;
    }
  >;
  /**
   * Absolute path to the directory to which the compiled source
   * should be outputted to.
   */
  outDir: string;
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
  /** Absolute path to the directory containing the source files. */
  srcDir: string;
  /** Target environment for the generated JavaScript. */
  target: NodePackScriptTarget;
  /** Absolute path to the TypeScript config file. */
  tsConfig?: string;
  /**
   * When watch mode is enabled, nodepack will listen for changes
   * on the file system and rebuild whenever a file changes.
   *
   * @experimental This option is currently experimental and you
   * may encounter bugs if you use it.
   */
  watch?: boolean;
  /**
   * List of external packages that should be compiled along with
   * the source files.
   */
  compileVendors?: string[];
};

export const validateBuildConfig = (config: BuildConfig) => {
  const isValidExtension = (ext: any) => {
    if (typeof ext !== "string") return false;
    return ext.startsWith(".") && ext.length > 1;
  };

  const isValidExtMapping = (
    extMapping: unknown
  ): extMapping is BuildConfig["extMapping"] => {
    if (typeof extMapping === "object" && extMapping !== null) {
      for (const [key, value] of Object.entries(extMapping)) {
        if (!isValidExtension(key)) return false;
        if (!isValidExtension(value) && value !== "%FORMAT%") return false;
      }
    }
    return true;
  };

  const isRelative = (path: unknown): path is `./${string}` => {
    if (typeof path !== "string") return false;
    return path.startsWith("./");
  };

  const isAbsolute = (filepath: unknown): filepath is string =>
    typeof filepath === "string" && path.isAbsolute(filepath);

  const isValidPathAliasMap = (
    map: unknown
  ): map is BuildConfig["pathAliases"] => {
    if (typeof map === "object" && map !== null) {
      for (const [key, value] of Object.entries(map)) {
        if (!key.endsWith("/*")) return false;
        if (!isRelative(value)) return false;
        if (!value.endsWith("/*")) return false;
      }
      return true;
    }
    return false;
  };

  const isRecordWithRelativeKeys = (
    r: unknown
  ): r is Record<`./${string}`, unknown> => {
    if (typeof r === "object" && r !== null) {
      return Object.keys(r).every((key) => isRelative(key));
    }
    return false;
  };

  const dt = DataType.RecordOf({
    target: DataType.OneOf(
      DataType.Literal("es2022"),
      DataType.Literal("es2021"),
      DataType.Literal("es2020"),
      DataType.Literal("es2019"),
      DataType.Literal("es2018"),
      DataType.Literal("es2017"),
      DataType.Literal("es2016"),
      DataType.Literal("es2015"),
      DataType.Literal("es5"),
      DataType.Literal("es3"),
      DataType.Literal("es6"),
      DataType.Literal("ESNext")
    ),
    srcDir: DataType.String,
    outDir: DataType.String,
    formats: DataType.ArrayOf(
      DataType.OneOf(
        DataType.Literal("commonjs"),
        DataType.Literal("cjs"),
        DataType.Literal("esmodules"),
        DataType.Literal("esm"),
        DataType.Literal("legacy")
      )
    ),
    tsConfig: { required: false, type: DataType.Custom(isAbsolute) },
    declarations: {
      required: false,
      type: DataType.OneOf(DataType.Boolean, DataType.Literal("only")),
    },
    extMapping: {
      required: false,
      type: DataType.Custom(isValidExtMapping),
    },
    pathAliases: {
      required: false,
      type: DataType.Custom(isValidPathAliasMap),
    },
    decoratorsMetadata: {
      required: false,
      type: DataType.Boolean,
    },
    watch: {
      required: false,
      type: DataType.Boolean,
    },
    isomorphicImports: {
      required: false,
      type: DataType.AllOf(
        DataType.Dict(
          DataType.RecordOf({
            cjs: { required: false, type: DataType.Custom(isRelative) },
            mjs: { required: false, type: DataType.Custom(isRelative) },
            js: { required: false, type: DataType.Custom(isRelative) },
          })
        ),
        DataType.Custom(isRecordWithRelativeKeys)
      ),
    },
    esbuildOptions: {
      required: false,
      type: DataType.RecordOf({}),
    },
    compileVendors: {
      required: false,
      type: DataType.ArrayOf(DataType.String),
    },
  });

  const validate = createValidatedFunction(
    dt,
    (config) => config as BuildConfig,
    (err) => {
      throw new Error(
        `Invalid config. Property '${err.fieldPath}' is incorrect.`
      );
    }
  );

  return validate(config);
};
