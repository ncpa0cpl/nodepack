import type esbuild from "esbuild";
import type { Stats } from "fs";
import fs from "fs/promises";
import path from "path";
import { asRelative } from "./as-relative";
import { changeExt } from "./change-ext";
import type { ExtensionMapper } from "./extension-mapper";
import type { PathAliasResolver } from "./path-alias-resolver";

export const ESbuildPlugin = (
  extMapper: ExtensionMapper,
  srcDir: string,
  pathAliases: PathAliasResolver
) => ({
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
                path: `${p}/index${extMapper.map(".js")}`,
                external: true,
              };
            } else
              return {
                path: `${importPath}${extMapper.map(".js")}`,
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
  },
});
