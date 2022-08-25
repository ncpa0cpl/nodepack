import type esbuild from "esbuild";
import type { Stats } from "fs";
import fs from "fs/promises";
import path from "path";

export const ESbuildAddImportExtensionsPlugin = (ext: string) => ({
  name: "nodepack-esbuild-add-import-extensions-plugin",
  setup(build: esbuild.PluginBuild) {
    build.onResolve({ filter: /.*/ }, async (args) => {
      if (args.importer) {
        if (args.path.startsWith(".")) {
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
              path: `${p}/index${ext}`,
              external: true,
            };
          } else return { path: `${args.path}${ext}`, external: true };
        } else
          return {
            path: args.path,
            external: true,
          };
      }
    });
  },
});
