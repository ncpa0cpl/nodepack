import type esbuild from "esbuild";
import type { Stats } from "fs";
import fs from "fs/promises";
import path from "path";
import { changeExt } from "./change-ext";
import type { ExtensionMapper } from "./extension-mapper";

export const ESbuildAddImportExtensionsPlugin = (
  extMapper: ExtensionMapper
) => ({
  name: "nodepack-esbuild-add-import-extensions-plugin",
  setup(build: esbuild.PluginBuild) {
    build.onResolve({ filter: /.*/ }, async (args) => {
      if (args.importer) {
        const importExt = path.extname(args.path).toLowerCase();
        if (args.path.startsWith(".")) {
          if (importExt === "") {
            let stat: Stats | undefined = undefined;

            try {
              stat = await fs.stat(path.resolve(args.resolveDir, args.path));
            } catch (e) {
              //
            }

            if (stat?.isDirectory()) {
              let p = args.path;
              if (p.endsWith("/")) {
                p = p.slice(0, -1);
              }
              return {
                path: `${p}/index${extMapper.map(".js")}`,
                external: true,
              };
            } else
              return {
                path: `${args.path}${extMapper.map(".js")}`,
                external: true,
              };
          } else if (extMapper.hasMapping(importExt)) {
            return {
              path: changeExt(args.path, extMapper.map(importExt)),
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
