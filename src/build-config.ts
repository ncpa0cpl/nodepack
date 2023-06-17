import { createValidatedFunction, OptionalField, Type } from "dilswer";
import type { BuildConfig } from "./build-config-type";
import type { ESBuildOptions } from "./esbuild-options-type";
import {
  isRecordWithRelativeKeys,
  isRelative,
  isValidExtMapping,
  isValidPathAliasMap,
} from "./utilities/validators";

const TypeEsbuildOptions = Type.Custom(
  (v): v is ESBuildOptions => typeof v === "object"
).setExtra({
  type: "ESBuildOptions",
  importFrom: "./esbuild-options-type",
});

const TypeRelativePath = Type.Custom(isRelative).setExtra({
  type: "`./${string}`",
});

const TypeRecordWithRelativePathsAsKeys = Type.Custom(
  isRecordWithRelativeKeys
).setExtra({
  type: "Record<`./${string}`, {}>",
});

const TypePathAliasMap = Type.Custom(isValidPathAliasMap).setExtra({
  type: 'Record<`${string}/*`, `./${string}/*` | "./*">',
});

const TypeExtensionMap = Type.Custom(isValidExtMapping).setExtra({
  type: 'Record<`.${string}`, `.${string}` | "%FORMAT%">',
});

const TypeBannerFooterLoader = Type.OneOf(
  Type.Literal("esbuild"),
  Type.Literal("typescript"),
  Type.Literal("copy")
);

const TypeBannerFooterMap = Type.Dict(
  Type.OneOf(
    Type.RecordOf({
      file: Type.String,
      loader: OptionalField(TypeBannerFooterLoader),
    }),
    Type.RecordOf({
      text: Type.String,
      loader: OptionalField(TypeBannerFooterLoader),
    })
  )
);

export const buildConfigSchema = Type.RecordOf({
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
    Type.Literal("es3"),
    Type.Literal("ES3"),
    Type.Literal("es5"),
    Type.Literal("ES5"),
    Type.Literal("es6"),
    Type.Literal("ES6"),
    Type.Literal("esnext"),
    Type.Literal("ESNext")
  ),
  srcDir: Type.String,
  outDir: Type.String,
  formats: Type.ArrayOf(
    Type.OneOf(
      Type.Literal("commonjs"),
      Type.Literal("cjs"),
      Type.Literal("esmodules"),
      Type.Literal("esm"),
      Type.Literal("legacy")
    )
  ),
  entrypoint: OptionalField(Type.String),
  bundle: OptionalField(Type.Boolean),
  tsConfig: OptionalField(Type.String),
  declarations: OptionalField(Type.OneOf(Type.Boolean, Type.Literal("only"))),
  exclude: OptionalField(
    Type.OneOf(Type.ArrayOf(Type.InstanceOf(RegExp)), Type.InstanceOf(RegExp))
  ),
  extMapping: OptionalField(TypeExtensionMap),
  pathAliases: OptionalField(TypePathAliasMap),
  decoratorsMetadata: OptionalField(Type.Boolean),
  esDecorators: OptionalField(Type.Boolean),
  watch: OptionalField(Type.Boolean),
  external: OptionalField(Type.ArrayOf(Type.String, Type.InstanceOf(RegExp))),
  replaceImports: OptionalField(Type.Dict(Type.String)),
  isomorphicImports: OptionalField(
    Type.AllOf(
      TypeRecordWithRelativePathsAsKeys,
      Type.Dict(
        Type.RecordOf({
          cjs: OptionalField(TypeRelativePath),
          mjs: OptionalField(TypeRelativePath),
          js: OptionalField(TypeRelativePath),
        })
      )
    )
  ),
  esbuildOptions: OptionalField(TypeEsbuildOptions),
  compileVendors: OptionalField(
    Type.OneOf(Type.Literal("all"), Type.ArrayOf(Type.String))
  ),
  preset: OptionalField(
    Type.RecordOf({
      node: OptionalField(Type.Boolean),
      deno: OptionalField(Type.Boolean),
      gjs: OptionalField(Type.Boolean),
    })
  ),
  banner: OptionalField(TypeBannerFooterMap),
  footer: OptionalField(TypeBannerFooterMap),
});

buildConfigSchema.setTitle("BuildConfig");

buildConfigSchema.recordOf.target
  .setTitle("CompilationTarget")
  .setDescription(
    "Target ECMAScript specification for the generated JavaScript."
  );

buildConfigSchema.recordOf.srcDir
  .setTitle("SourceDirectoryPath")
  .setDescription(
    "Absolute path to the directory containing the source files."
  );

buildConfigSchema.recordOf.outDir
  .setTitle("OutputDirectoryPath")
  .setDescription(
    "Absolute path to the directory to which the compiled source should be outputted to."
  );

buildConfigSchema.recordOf.formats.setTitle("OutputFormats").setDescription(
  `
List of format types that should be outputted.

- \`cjs\` format - CommonJS module format with a \`.cjs\` file extension.
- \`esm\` format - ES module format with a \`.mjs\` file extension.
- \`legacy\` format - CommonJS module format with a \`.js\` file extension.
`.trim()
);

buildConfigSchema.recordOf.tsConfig.type
  .setTitle("TsConfigPath")
  .setDescription("Absolute path to the TypeScript config file.");

buildConfigSchema.recordOf.extMapping.type
  .setTitle("ExtensionMap")
  .setDescription(
    "Allows to customize the file extension of the outputted files."
  );

buildConfigSchema.recordOf.exclude.type
  .setTitle("CompileExcludePatterns")
  .setDescription("`RegExp` patterns used to exclude files from compilation.");

buildConfigSchema.recordOf.declarations.type
  .setTitle("TsDeclarationOption")
  .setDescription(
    `
Indicates if typescript declarations are to be generated. If 
set to true, \`.d.ts\` files will be generated along the JavaScript 
files, if set to \`only\` no JavaScript will be emitted, 
only the declarations.

To be able to generate declarations, TypeScript packages must 
be installed.
`.trim()
  );

buildConfigSchema.recordOf.compileVendors.type
  .setTitle("CompiledVendorsList")
  .setDescription(
    `
List of external packages that should be compiled along with the source files.

Each specified vendor package will be compiled into a single bundle file and
placed inside a \`_vendors\` directory.

If set to \`all\`, all external packages will be compiled.
    `.trim()
  );

buildConfigSchema.recordOf.pathAliases.type
  .setTitle("PathAliases")
  .setDescription(
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
`.trim()
  );

buildConfigSchema.recordOf.isomorphicImports.type
  .setTitle("IsomorphicImports")
  .setDescription(
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
`.trim()
  );

buildConfigSchema.recordOf.esbuildOptions.type.setDescription(
  "Options to pass to the `esbuild` compiler."
);

buildConfigSchema.recordOf.watch.type.setTitle("WatchOption").setDescription(
  `
When watch mode is enabled, nodepack will listen for changes 
on the file system and rebuild whenever a file changes.

@experimental
This option is currently experimental and you may encounter bugs if you use it.
`.trim()
);

buildConfigSchema.recordOf.external.type
  .setTitle("ExternalPackages")
  .setDescription(
    "List of packages that should be excluded from compilation. " +
      "Imports of those packages will be left as is, unless `replaceImports` " +
      "for that package is specified."
  );

buildConfigSchema.recordOf.replaceImports.type
  .setTitle("ReplaceImportsMap")
  .setDescription(
    "A map of import paths/packages that should be replaced with another import."
  );

buildConfigSchema.recordOf.bundle.type.setDescription(
  `
When enabled, the entire program will be bundled into a single file, 
with the exception of files and packages marked as external or as vendors.

\`entrypoint\` option must be provided when \`bundle\` is enabled.`
);

buildConfigSchema.recordOf.preset.type.recordOf.node.type.setDescription(
  "When enabled all the packages provided by the Node environment will be added to the `external` array."
);

TypeBannerFooterMap.setDescription(
  "A map of filename regex patterns to text or files that ought to be appended or prepended to them at the build time."
);

buildConfigSchema.recordOf.decoratorsMetadata.type.setDescription(
  "When enabled, each file with TypeScript decorators will be first compiled via " +
    "TypeScript (since esbuild does not support emitting decorators metadata) " +
    "and then compiled via esbuild as usual. This will result in slower build times. " +
    "And broken source maps.\n\nThis option should not be used alog with `esDecorators` option."
);

buildConfigSchema.recordOf.esDecorators.type.setDescription(
  "Esbuild does not support ECMScript decorators as of yet. When this options is " +
    "enabled, each file with decorators will be first compiled via TypeScript " +
    "and then compiled via esbuild as usual. This will result in slower build times. " +
    "And broken source maps.\n\nThis option should not be used alog with `decoratorsMetadata` option."
);

export const validateBuildConfig = (config: BuildConfig) => {
  const validate = createValidatedFunction(
    buildConfigSchema,
    (config) => config as BuildConfig,
    (err) => {
      throw new Error(
        `Invalid config. Property '${err.fieldPath}' is incorrect.`
      );
    }
  );

  return validate(config);
};
