import type esbuild from "esbuild";
import fs from "fs/promises";
import path from "path";
import type { ProgramContext } from "../program";
import { asRelative } from "./as-relative";
import { changeExt } from "./change-ext";
import type { ExtensionMapper } from "./extension-mapper";
import { CacheMap } from "./info-cache";
import { isDirectory } from "./is-directory";
import { fileExists } from "./is-real-path";

const hasExtension = (filepath: string) => path.extname(filepath) !== "";

const withExt = async (filepath: string) => {
  const withTsExt = `${filepath}.ts`;
  if (await fileExists(withTsExt)) return withTsExt;

  const withMtsExt = `${filepath}.mts`;
  if (await fileExists(withMtsExt)) return withMtsExt;

  const withCtsExt = `${filepath}.cts`;
  if (await fileExists(withCtsExt)) return withCtsExt;

  const withJsExt = `${filepath}.js`;
  if (await fileExists(withJsExt)) return withJsExt;

  const withMjsExt = `${filepath}.mjs`;
  if (await fileExists(withMjsExt)) return withMjsExt;

  const withCjsExt = `${filepath}.cjs`;
  if (await fileExists(withCjsExt)) return withCjsExt;
};

const filesCache = new CacheMap<{
  hasDecorators: boolean;
  originalSourceFile?: string;
  transpiledFile?: Promise<string>;
}>();

export const ESbuildPlugin = (params: {
  program: ProgramContext;
  extMapper: ExtensionMapper;
  srcDir: string;
  outDir: string;
  outfile: string;
  outExt: string;
  bundle: boolean;
}) => {
  const { extMapper, outDir, program, srcDir, outfile, outExt, bundle } =
    params;
  const vendors = new Set(program.buildConfig.compileVendors ?? []);
  const additionalExternal = program.buildConfig.esbuildOptions?.external ?? [];
  const external = new Set(
    (program.buildConfig.external ?? []).concat(additionalExternal)
  );
  const importReplace = new Map(
    Object.entries(program.buildConfig.replaceImports ?? {})
  );

  const {
    pathAliases,
    tsProgram,
    buildConfig: { decoratorsMetadata = false },
  } = program;

  return {
    name: "nodepack-esbuild-plugin",
    setup(build: esbuild.PluginBuild) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        const originalPath = args.path;
        args = { ...args };

        const replaceWith = importReplace.get(args.path);
        if (replaceWith) {
          if (replaceWith.startsWith(".")) {
            const fromImporterToReplacement = path.relative(
              path.dirname(outfile),
              path.resolve(srcDir, replaceWith)
            );
            args.path = fromImporterToReplacement;
          } else {
            args.path = replaceWith;
          }
        }

        if (external.has(originalPath)) {
          return {
            external: true,
            path: args.path,
          };
        }

        if (vendors.has(args.path)) {
          return {
            external: true,
            path: asRelative(
              path.relative(
                path.dirname(outfile),
                path.resolve(
                  outDir,
                  program.vendorsDir,
                  `${args.path}${outExt}`
                )
              )
            ),
          };
        }

        if (args.importer) {
          let importPath = args.path;
          let absImportPath = path.resolve(args.resolveDir, importPath);

          if (pathAliases.isAlias(args.path)) {
            absImportPath = path.resolve(
              srcDir,
              pathAliases.replaceAliasPattern(args.path)
            );

            importPath = asRelative(
              path.relative(args.resolveDir, absImportPath)
            );
          }

          if (importPath.startsWith(".")) {
            const importExt = (await fileExists(absImportPath))
              ? path.extname(importPath).toLowerCase()
              : "";

            if (importExt === "") {
              // scenario: import is a filepath, but has no extension

              if (await isDirectory(absImportPath)) {
                // If the import path points to a directory,
                // rewrite the path to the index file inside
                // that directory. So for example:
                // "./src/Common" gets rewritten to "./src/Common/index.ts"

                if (bundle) {
                  const files = await fs.readdir(absImportPath);
                  const indexFile = files.find((f) =>
                    /^index\.[mc]?(js|ts)$/.test(f)
                  );

                  if (!indexFile) {
                    throw new Error(
                      `Import points into a directory without a index file: ${absImportPath}`
                    );
                  }

                  // For bundling the filepaths need to be absolute
                  return {
                    path: path.join(absImportPath, indexFile),
                  };
                }

                return {
                  path: path.join(importPath, `index${extMapper.getDefault()}`),
                  external: true,
                };
              } else {
                if (bundle) {
                  // For bundling the filepaths need to be absolute
                  return {
                    path: await withExt(absImportPath),
                  };
                }

                return {
                  path: `${importPath}${extMapper.getDefault()}`,
                  external: true,
                };
              }
            } else {
              if (bundle) {
                // For bundling the filepaths need to be absolute
                return {
                  path: hasExtension(absImportPath)
                    ? absImportPath
                    : await withExt(absImportPath),
                };
              }

              if (extMapper.hasMapping(importExt)) {
                return {
                  path: changeExt(importPath, extMapper.map(importExt)),
                  external: true,
                };
              }
            }
          } else {
            if (bundle) {
              // For bundling the filepaths need to be absolute
              return {
                path: args.path,
              };
            }

            return {
              path: args.path,
              external: true,
            };
          }
        }
      });

      if (decoratorsMetadata) {
        const decoratorRegex =
          /class.*?{.*?@[a-zA-Z0-9]+?(\(.*?\)){0,1}[\s\n]+?[a-zA-Z0-9]+?.+?;/ms;
        const hasDecorators = (fileContent: string) =>
          decoratorRegex.test(fileContent);

        build.onLoad({ filter: /\.[mc]{0,1}tsx{0,1}/ }, async (args) => {
          const ext = path.extname(args.path);
          const loader = [".ts", ".mts", ".cts"].includes(ext) ? "ts" : "tsx";

          const cachedFile = filesCache.get(args.path);
          if (cachedFile) {
            if (cachedFile.hasDecorators === false)
              return { contents: cachedFile.originalSourceFile, loader };
            else return { contents: await cachedFile.transpiledFile, loader };
          }

          const fileContent = await fs.readFile(args.path, "utf-8");

          const needToTranspileWithTs = hasDecorators(fileContent);

          if (needToTranspileWithTs) {
            const transpiledFile = tsProgram.parseFile({
              filePath: args.path,
              fileContent: fileContent,
            });

            filesCache.set(args.path, {
              hasDecorators: true,
              transpiledFile,
            });

            return { contents: await transpiledFile, loader: "js" };
          } else {
            filesCache.set(args.path, {
              hasDecorators: false,
              originalSourceFile: fileContent,
            });
          }

          return { contents: fileContent, loader };
        });
      }
    },
  };
};
