import type esbuild from "esbuild";
import fs from "fs/promises";
import path from "path";
import type { ProgramContext } from "../program";
import { asRelative } from "./as-relative";
import { changeExt } from "./change-ext";
import type { ExtensionMapper } from "./extension-mapper";
import { CacheMap } from "./info-cache";
import { isDirectory } from "./is-directory";
import { isRealPath } from "./is-real-path";

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
  outExt: string;
  vendors: string[];
}) => {
  const { extMapper, outDir, program, srcDir, vendors, outExt } = params;

  const {
    pathAliases,
    tsProgram,
    buildConfig: { decoratorsMetadata = false },
  } = program;

  return {
    name: "nodepack-esbuild-plugin",
    setup(build: esbuild.PluginBuild) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (vendors.includes(args.path)) {
          const fromSrcToImporter = path.relative(
            srcDir,
            path.dirname(args.importer)
          );

          const importerOut = path.resolve(outDir, fromSrcToImporter);

          return {
            external: true,
            path: path.relative(
              importerOut,
              path.resolve(outDir, program.vendorsDir, `${args.path}${outExt}`)
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
            const importExt = (await isRealPath(absImportPath))
              ? path.extname(importPath).toLowerCase()
              : "";

            if (importExt === "") {
              if (await isDirectory(absImportPath)) {
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
