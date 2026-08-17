import { Type, validator } from "dilswer";
import type { BuildConfig } from "./build-config-type";
import type { ESBuildOptions } from "./esbuild-options-type";
import {
  isRecordWithRelativeKeys,
  isRelative,
  isValidExtMapping,
  isValidPathAliasMap,
} from "./utilities/validators";

const TypeEsbuildOptions = Type.Custom(
  (v): v is ESBuildOptions => typeof v === "object",
).meta.extra({
  type: "ESBuildOptions",
  importFrom: "./esbuild-options-type",
});

const TypeRelativePath = Type.Custom(isRelative).meta.extra({
  type: "`./${string}`",
});

const TypeRecordWithRelativePathsAsKeys = Type.Custom(
  isRecordWithRelativeKeys,
).meta.extra({
  type: "Record<`./${string}`, {}>",
});

const TypePathAliasMap = Type.Custom(isValidPathAliasMap).meta.extra({
  type: "Record<`${string}/*`, `./${string}/*` | \"./*\">",
});

const TypeExtensionMap = Type.Custom(isValidExtMapping).meta.extra({
  type: "Record<`.${string}`, `.${string}` | \"%FORMAT%\">",
});

const TypeOnBuildCompleteCb = Type.Function.meta.extra({
  type: "() => void | (() => any)",
});

const TypeBannerFooterLoader = Type.OneOf(
  Type.Literal("esbuild"),
  Type.Literal("typescript"),
  Type.Literal("copy"),
);

const TypeBannerFooterMap = Type.Dict(
  Type.OneOf(
    Type.Record({
      file: Type.String,
      loader: Type.Option(TypeBannerFooterLoader),
      minify: Type.Option(Type.Boolean),
    }),
    Type.Record({
      text: Type.String,
      loader: Type.Option(TypeBannerFooterLoader),
      minify: Type.Option(Type.Boolean),
    }),
  ),
);

const CompiledVendorPackage = Type.Record({
  name: Type.String,
  vendors: Type.Array(Type.String),
})
  .meta.title("CompiledVendorPackage")
  .meta.description(
    "A package of mutlpiple vendors to package into a single bundle.",
  );

export const buildConfigSchema = Type.Record({
  target: Type.OneOf(
    Type.Literal("es2015"),
    Type.Literal("ES2015"),
    Type.Literal("es2016"),
    Type.Literal("ES2016"),
    Type.Literal("es2017"),
    Type.Literal("ES2017"),
    Type.Literal("es2018"),
    Type.Literal("ES2018"),
    Type.Literal("es2019"),
    Type.Literal("ES2019"),
    Type.Literal("es2020"),
    Type.Literal("ES2020"),
    Type.Literal("es2021"),
    Type.Literal("ES2021"),
    Type.Literal("es2022"),
    Type.Literal("ES2022"),
    Type.Literal("ES2023"),
    Type.Literal("es2023"),
    Type.Literal("ES2024"),
    Type.Literal("es2024"),
    Type.Literal("ES2025"),
    Type.Literal("es2025"),
    Type.Literal("es6"),
    Type.Literal("ES6"),
    Type.Literal("esnext"),
    Type.Literal("ESNext"),
  ),
  srcDir: Type.String,
  outDir: Type.String,
  formats: Type.Array(
    Type.OneOf(
      Type.Literal("commonjs"),
      Type.Literal("cjs"),
      Type.Literal("esmodules"),
      Type.Literal("esm"),
      Type.Literal("legacy"),
    ),
  ),
  entrypoint: Type.Option(Type.String),
  bundle: Type.Option(Type.Boolean),
  tsConfig: Type.Option(Type.String),
  declarations: Type.Option(Type.OneOf(Type.Boolean, Type.Literal("only"))),
  exclude: Type.Option(
    Type.OneOf(Type.Array(Type.InstanceOf(RegExp)), Type.InstanceOf(RegExp)),
  ),
  extMapping: Type.Option(TypeExtensionMap),
  pathAliases: Type.Option(TypePathAliasMap),
  decoratorsMetadata: Type.Option(Type.Boolean),
  esDecorators: Type.Option(Type.Boolean),
  watch: Type.Option(Type.Boolean),
  external: Type.Option(Type.Array(Type.String, Type.InstanceOf(RegExp))),
  replaceImports: Type.Option(Type.Dict(Type.String)),
  isomorphicImports: Type.Option(
    Type.AllOf(
      TypeRecordWithRelativePathsAsKeys,
      Type.Dict(
        Type.Record({
          cjs: Type.Option(TypeRelativePath),
          mjs: Type.Option(TypeRelativePath),
          js: Type.Option(TypeRelativePath),
        }),
      ),
    ),
  ),
  esbuildOptions: Type.Option(TypeEsbuildOptions),
  compileVendors: Type.Option(
    Type.OneOf(
      Type.Literal("all"),
      Type.Array(Type.String, CompiledVendorPackage),
    ),
  ),
  preset: Type.Option(
    Type.Record({
      node: Type.Option(Type.Boolean),
      deno: Type.Option(Type.Boolean),
      gjs: Type.Option(Type.Boolean),
    }),
  ),
  banner: Type.Option(TypeBannerFooterMap),
  footer: Type.Option(TypeBannerFooterMap),
  onBuildComplete: Type.Option(TypeOnBuildCompleteCb),
  watchAbortSignal: Type.Option(Type.InstanceOf(AbortSignal)),
  parsableExtensions: Type.Option(Type.Array(Type.String)),
});

buildConfigSchema.meta.title("BuildConfig");

buildConfigSchema.recordOf.target
  .meta.title("CompilationTarget")
  .meta.description(
    "Target ECMAScript specification for the generated JavaScript.",
  );

buildConfigSchema.recordOf.srcDir
  .meta.title("SourceDirectoryPath")
  .meta.description(
    "Absolute path to the directory containing the source files.",
  );

buildConfigSchema.recordOf.outDir
  .meta.title("OutputDirectoryPath")
  .meta.description(
    "Absolute path to the directory to which the compiled source should be outputted to.",
  );

buildConfigSchema.recordOf.formats.meta.title("OutputFormats").meta.description(
  `
List of format types that should be outputted.

- \`cjs\` format - CommonJS module format with a \`.cjs\` file extension.
- \`esm\` format - ES module format with a \`.mjs\` file extension.
- \`legacy\` format - CommonJS module format with a \`.js\` file extension.
`.trim(),
);

buildConfigSchema.recordOf.tsConfig.type
  .meta.title("TsConfigPath")
  .meta.description("Absolute path to the TypeScript config file.");

buildConfigSchema.recordOf.extMapping.type
  .meta.title("ExtensionMap")
  .meta.description(
    "Allows to customize the file extension of the outputted files.",
  );

buildConfigSchema.recordOf.exclude.type
  .meta.title("CompileExcludePatterns")
  .meta.description(
    "`RegExp` patterns used to exclude files from compilation.",
  );

buildConfigSchema.recordOf.declarations.type
  .meta.title("TsDeclarationOption")
  .meta.description(
    `
Indicates if typescript declarations are to be generated. If
set to true, \`.d.ts\` files will be generated along the JavaScript
files, if set to \`only\` no JavaScript will be emitted,
only the declarations.

To be able to generate declarations, TypeScript packages must
be installed.
`.trim(),
  );

buildConfigSchema.recordOf.compileVendors.type
  .meta.title("CompiledVendorsList")
  .meta.description(
    `
List of external packages that should be compiled along with the source files.

Each specified vendor package will be compiled into a single bundle file and
placed inside a \`_vendors\` directory.

If set to \`all\`, all external packages will be compiled.
    `.trim(),
  );

buildConfigSchema.recordOf.pathAliases.type
  .meta.title("PathAliases")
  .meta.description(
    `
A map of path aliases.

Each path alias must end with a \`/*\`, and each alias value must be
a path relative to the \`srcDir\`, start with a \`./\` and end with a \`/*\`.

@example

  build({
    pathAliases: {
      "@Utils/*": "./Utils/*",
    },
  });
`.trim(),
  );

buildConfigSchema.recordOf.isomorphicImports.type
  .meta.title("IsomorphicImports")
  .meta.description(
    `
Files that should get their imports replaced to other path,
depending on the format it is compiled to.

All path provided should be relative to the \`srcDir\`.

If no import is defined for a format, the import will be left
as is.

Since some of the features in Node are only available for
ESModules or CommonJS modules (for example \`__filename\` or
\`import.meta\`), it might be helpful to have different file be
imported depending on which module type the program is using.

To define a different index file for each of the compiled formats:

@example

  build({
    isomorphicImports: {
      "./index.ts": {
        mjs: "./index.esm.ts",
        cjs: "./index.cjs.ts",
        js: "./index.legacy.ts",
      },
    },
  });
`.trim(),
  );

buildConfigSchema.recordOf.esbuildOptions.type.meta.description(
  "Options to pass to the `esbuild` compiler.",
);

buildConfigSchema.recordOf.watch.type.meta.title("WatchOption").meta
  .description(
    `
When watch mode is enabled, nodepack will listen for changes
on the file system and rebuild whenever a file changes.

@experimental
This option is currently experimental and you may encounter bugs if you use it.
`.trim(),
  );

buildConfigSchema.recordOf.external.type
  .meta.title("ExternalPackages")
  .meta.description(
    "List of packages that should be excluded from compilation. "
      + "Imports of those packages will be left as is, unless `replaceImports` "
      + "for that package is specified.",
  );

buildConfigSchema.recordOf.replaceImports.type
  .meta.title("ReplaceImportsMap")
  .meta.description(
    "A map of import paths/packages that should be replaced with another import.",
  );

buildConfigSchema.recordOf.bundle.type.meta.description(
  `
When enabled, the entire program will be bundled into a single file,
with the exception of files and packages marked as external or as vendors.

\`entrypoint\` option must be provided when \`bundle\` is enabled.`,
);

buildConfigSchema.recordOf.preset.type.recordOf.node.type.meta.description(
  "When enabled all the packages provided by the Node environment will be added to the `external` array.",
);

TypeBannerFooterMap.meta.description(
  "A map of filename regex patterns to text or files that ought to be appended or prepended to them at the build time.",
);

buildConfigSchema.recordOf.decoratorsMetadata.type.meta.description(
  "When enabled, each file with TypeScript decorators will be first compiled via "
    + "TypeScript (since esbuild does not support emitting decorators metadata) "
    + "and then compiled via esbuild as usual. This will result in slower build times. "
    + "And broken source maps.\n\nThis option should not be used alog with `esDecorators` option.",
);

buildConfigSchema.recordOf.esDecorators.type.meta.description(
  "Esbuild does not support ECMScript decorators as of yet. When this options is "
    + "enabled, each file with decorators will be first compiled via TypeScript "
    + "and then compiled via esbuild as usual. This will result in slower build times. "
    + "And broken source maps.\n\nThis option should not be used alog with `decoratorsMetadata` option.",
);

buildConfigSchema.recordOf.onBuildComplete.type.meta.description(
  "Only in watch mode, a callback that will be invoked after each compilation, can return another function used for cleanup.",
);

buildConfigSchema.recordOf.watchAbortSignal.type.meta.description(
  "Only in watch mode, an instance of AbortSignal that can be used to abort the watchers.",
);

buildConfigSchema.recordOf.parsableExtensions.type.meta.description(
  "List of file extensions that should be parsed by the ESBuild compiler. By default only"
    + " filetypes that ESBuild can handle are compiled, if a plugin is added for handling"
    + " other filetypes - the appropriate extension should be added here.",
);

const validateConfig = validator(buildConfigSchema, { details: true });

export const validateBuildConfig = (config: BuildConfig) => {
  const result = validateConfig(config);

  if (result.success) {
    return config;
  }

  throw result.error;
};
