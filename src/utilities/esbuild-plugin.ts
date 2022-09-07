import type esbuild from "esbuild";
import type { Stats } from "fs";
import fs from "fs/promises";
import path from "path";
import type { ProgramContext } from "../program";
import { asRelative } from "./as-relative";
import { changeExt } from "./change-ext";
import type { ExtensionMapper } from "./extension-mapper";
import { CacheMap } from "./info-cache";

const filesCache = new CacheMap<{
  hasDecorators: boolean;
  originalSourceFile?: string;
  transpiledFile?: Promise<string>;
}>();

export const ESbuildPlugin = (
  program: ProgramContext,
  extMapper: ExtensionMapper,
  srcDir: string
) => {
  const {
    pathAliases,
    tsProgram,
    buildConfig: { decoratorsMetadata = false },
  } = program;

  return {
    name: "nodepack-esbuild-plugin",
    setup(build: esbuild.PluginBuild) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (args.importer) {
          let importPath = args.path;

          if (pathAliases.isAlias(args.path)) {
            const absImportPath = path.resolve(
              srcDir,
              pathAliases.replaceAliasPattern(args.path)
            );

            importPath = asRelative(
              path.relative(args.resolveDir, absImportPath)
            );
          }

          const importExt = path.extname(importPath).toLowerCase();
          if (importPath.startsWith(".")) {
            if (importExt === "") {
              let stat: Stats | undefined = undefined;

              try {
                stat = await fs.stat(path.resolve(args.resolveDir, importPath));
              } catch (e) {
                //
              }

              if (stat?.isDirectory()) {
                let p = importPath;
                if (p.endsWith("/")) {
                  p = p.slice(0, -1);
                }
                return {
                  path: `${p}/index${extMapper.getDefault()}`,
                  external: true,
                };
              } else
                return {
                  path: `${importPath}${extMapper.getDefault()}`,
                  external: true,
                };
            } else if (extMapper.hasMapping(importExt)) {
              return {
                path: changeExt(importPath, extMapper.map(importExt)),
                external: true,
              };
            }
          } else
            return {
              path: args.path,
              external: true,
            };
        }
      });

      if (decoratorsMetadata) {
        const decoratorRegex =
          /class.*?{.*?@[a-zA-Z0-9]+?(\(.*?\)){0,1}[\s\n]+?[a-zA-Z0-9]+?\(.*?\).*?[\s\n]*?{.+?}/ms;
        const hasDecorators = (fileContent: string) =>
          decoratorRegex.test(fileContent);

        build.onLoad({ filter: /\.[mc]{0,1}tsx{0,1}/ }, async (args) => {
          const cachedFile = filesCache.get(args.path);
          if (cachedFile) {
            if (cachedFile.hasDecorators === false)
              return { contents: cachedFile.originalSourceFile };
            else return { contents: await cachedFile.transpiledFile };
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

            return { contents: await transpiledFile };
          } else {
            filesCache.set(args.path, {
              hasDecorators: false,
              originalSourceFile: fileContent,
            });
          }

          return { contents: fileContent };
        });
      }
    },
  };
};
