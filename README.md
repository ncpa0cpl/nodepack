# nodepack

## Features

- Extremely easy to use
- Fast (uses ESBuild under the hood)
- Build your project for CommonJS modules, ESModules and legacy environments all at once
- Generate TypeScript declarations along with the compiled JavaScript
- Generate TypeScript declarations for JSON files
- Path aliases out of the box, along with import rewriting in `.d.ts` files

## Installation

1. Intall this package and `esbuild` using _yarn_ or _npm_:

   ```sh
     npm i -D esbuild @ncpa0cpl/nodepack
   ```

   or

   ```sh
     yarn add -D esbuild @ncpa0cpl/nodepack
   ```

2. (Optional) If you want to be able to generate TypeScript declarations also install `typescript`.
3. (Optional) If you want to be able to generate TypeScript declarations for JSON files also install `json-to-ts` package.

## Usage

> **<span style="color:red">Important</span>**
>
> Make sure to explicitly set all type exports/imports as a type exports/imports in your project files. (use eslint rules to enforce this rule: [for exports](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/docs/rules/consistent-type-exports.md) and [for imports](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/docs/rules/consistent-type-imports.md))
>
> All exports and imports of TS types that are not marked as such will be left over in the compiled JS files, which will lead to runtime errors.

Execute this JavaScript script to build the files for the selected formats:

```ts
import { build } from "@ncpa0cpl/nodepack";
import process from "node:process";
import path from "path";

build({
  target: "es6",
  srcDir: path.resolve(process.cwd(), "src"),
  outDir: path.resolve(process.cwd(), "dist"),
  formats: ["cjs", "esm", "legacy"],
  declarations: true,
});
```

Then for node environments to correctly resolve the build files depending on the environment include the following in your `package.json` file:

```js
{
  // main entrypoint for legacy environments that do not support the `exports` field
  "main": "./dist/legacy/index.js",
  // main type declarations entrypoint for legacy environments that do not support the `exports` field
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      // main type declarations entrypoint
      "types": "./dist/types/index.d.ts",
      // main entrypoint for environments that use the ESModules
      "import": "./dist/esm/index.mjs",
      // main entrypoint for environments that use the CommonJS modules
      "require": "./dist/cjs/index.cjs"
    }
  }
}
```

#### Raw JSON

```json
{
  "main": "./dist/legacy/index.js",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/esm/index.mjs",
      "require": "./dist/cjs/index.cjs"
    }
  }
}
```

## Options

#### target

Target environment for the generated JavaScript.

#### srcDir

Absolute path to the directory containing the source files.

#### outDir

Absolute path to the directory to which the compiled source should be outputted to.

#### formats

List of format types that should be outputted.

- `cjs` format - CommonJS module format with a .cjs file extension.
- `esm` format - ES module format with a .mjs file extension.
- `legacy` format - CommonJS module format with a .js file extension.

#### tsConfig

Absolute path to the TypeScript config file.

#### exclude

Regex patterns used to exclude files from compilation.

#### declarations

Indicates if typescript declarations are to be generated. If set to true, `.d.ts` files will be generated along the JavaScript files, if set to `only` no JavaScript will be emitted, only the declarations.

To be able to generate declarations, TypeScript package must be installed.

#### extMapping

Allows to customize the file extension of the generated files. This is useful for custom esbuild loaders, like a file loader.

If you want to map given extension to the used format (`.cjs`, `.mjs` or `.js`), you can use a `%FORMAT%` wildcard instead of a extension.

##### Example

To map all `.png` files to the javascript extension depending on which format it is generated for:

```ts
import { build } from "@ncpa0cpl/nodepack";

build({
  // ...
  formats: ["cjs", "esm", "legacy"],
  extMapping: {
    ".png": "%FORMAT%",
  },
  esbuildOptions: {
    loader: {
      ".png": "dataurl",
    },
  },
});
```

With the above options, a source with a `./src/icon.png` file would get transformed to:

```
dist
|- cjs
|--|- icon.cjs
|- esm
|--|- icon.mjs
|- legacy
|--|- icon.js
```

To statically map `.png` file to other extension just replace the `%FORMAT%` with the desired extension.

#### pathAliases

A map of path aliases.

Each path alias must end with a `/*`, and each alias value must be a path relative to the `srcDir`, start with a `./` and end with a `/*`.

Path aliases are used to replace imports in JavaScript files for all formats and TypeScript declaration files.

##### Example

```ts
import { build } from "@ncpa0cpl/nodepack";

build({
  // ...
  pathAliases: {
    "@Utils/*": "./Utils/*",
  },
});
```

#### esbuildOptions

Options to pass to the `esbuild` compiler. ([See available options here](https://esbuild.github.io/api/#simple-options))
