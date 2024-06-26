## 2.3.3 (March 27, 2024)

### Bug Fixes

- #### fix: onBuildComplete was called without waiting for build to complete ([#29](https://github.com/ncpa0cpl/nodepack/pull/29))

  Fixed a bug that was allowing for the `onBuildComplete` in watch mode to be called before the build actually completed.

## 2.3.2 (January 14, 2024)

### Features

- #### feat: added new build option ([#28](https://github.com/ncpa0cpl/nodepack/pull/28))

  Added a new build option: `parsableExtensions`

## 2.3.1 (January 8, 2023)

### Bug Fixes

- #### fix: watch mode

  Added chokidar for watch mode instead of relying on the fs.watch function.

## 2.3.0 (August 23, 2023)

### Features

- #### feat: added support for compiling the ECMAScript decorators ([#25](https://github.com/ncpa0cpl/nodepack/pull/25))

  Added a new config option (`esDecorators`) that enables compiling the new ECMAScript decorators. When enabled, for each file containing decorators TypeScript will be used to parse it into JavaScript before handing it to the esbuild.

- #### feat: adding banner and footers to individual compiled files ([#24](https://github.com/ncpa0cpl/nodepack/pull/24))

  Added two new config options: `footer` and `banner`. Those can be used to inject code or comments to the top or bottom of selected output files. Both options can be provided with either a string or a filename with the contents to add to the output. Additionally provided banner and footers can be parsed using the specified loader ("copy", "esbuild" and "typescript"). By default string are loaded using "copy", and files are loaded using "esbuild".

## 2.2.2 (June 29, 2023)

### Bug Fixes

- #### fix: esbuild error when attempting to bundle project with non-external node modules imports ([#23](https://github.com/ncpa0cpl/nodepack/pull/23))

  Fixed a bug which caused builds with the `bundle` option enabled to fail, if the project was importing any npm modules. (If the module was being marked as external this bug was not occurring.)

## 2.2.1 (June 14, 2023)

### Bug Fixes

- #### fix: import resolution for vendor packages ([#21](https://github.com/ncpa0cpl/nodepack/pull/21))

  Fixed an issue with import resolution for vendor packages. Every import within vendors was treated as a filesystem path unless marked as external or the `compileVendors` option was set to `all`. This meant that if a vendor was importing a package from `node_modules` the vendor compilation would fail.

## 2.2.0 (June 2, 2023)

### Features

- #### feat: extended the `compileVendors` and `external` options ([#19](https://github.com/ncpa0cpl/nodepack/pull/19))

  - `compileVendors` can now take a string literal "all" instead of a list of packages, when this option is selected, all imported packages that are not file-paths will be compiled into a separate file in the "\_vendors" dir
  - `external` can now take a regex pattern

  Additionally added presets that provide a list of `external` packages for Node, Deno and GJS environments.

- #### feat: added bundle option to the config ([#18](https://github.com/ncpa0cpl/nodepack/pull/18))

  When this new option is enabled, and an entry-point is provided, instead of compiling all the files separately, bundles for each format will be generated.

  An exception to this are imports marked as external, as well as disparately compiled vendors.

- #### Feat: external and import replace option ([#17](https://github.com/ncpa0cpl/nodepack/pull/17))

  Added two new options to the config:

  - `external` - allows to specify a list of package imports which will be left alone when compiling, and wont be bundled with the output files
  - `replaceImports` - allows to define import mapings, for example if a import map is specified like this: `{ eventemitter2: "eventemitter3" }`, all imports of `eventemitter2` in the source will be replaced with an import of `eventemitter3` in the output.
