# nodepack

## Installation

1. Create a `.npmrc` file in your project if it doesn't exists already.
2. Add the following lines to it:
   ```npmrc
   //npm.pkg.github.com/:_authToken=${GITHUB_PERSONAL_TOKEN}
   @ncpa0cpl:registry=https://npm.pkg.github.com
   ```
3. Generate a Personal Access Token to your GitHub Account with a package read permission enabled.
4. Set the `GITHUB_PERSONAL_TOKEN` environmental variable on you local machine to the generated token.
5. Run the installation:
   ```sh
   npm i esbuild @ncpa0cpl/nodepack
   ```
   or
   ```sh
   yarn add esbuild @ncpa0cpl/nodepack
   ```

## Usage

```ts
import { build } from "@ncpa0cpl/nodepack";
import process from "node:process";
import path from "path";

build({
  target: "es6",
  srcDir: path.resolve(process.cwd(), "src"),
  outDir: path.resolve(process.cwd(), "dist"),
  formats: ["cjs", "esm", "legacy"],
});
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

To be able to generate declarations, TypeScript packages must be installed.

#### esbuildOptions

Options to pass to the `esbuild` compiler.
