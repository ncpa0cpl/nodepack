import type esbuild from "esbuild";
import path from "path";
import type { ProgramContext } from "../program";
import { asRelative } from "./as-relative";

export const VendorBuilderPlugin = (params: {
  program: ProgramContext;
  vendor: string;
  srcDir: string;
  outfile: string;
  outExt: string;
}): esbuild.Plugin => {
  const { program, vendor, outfile, srcDir, outExt } = params;

  const vendors = new Set(program.buildConfig.compileVendors ?? []);
  const additionalExternal = program.buildConfig.esbuildOptions?.external ?? [];
  const external = new Set(
    (program.buildConfig.external ?? []).concat(additionalExternal)
  );
  const importReplace = new Map(
    Object.entries(program.buildConfig.replaceImports ?? {})
  );

  return {
    name: "nodepack-vendor-builder-plugin",
    setup(build) {
      build.onResolve({ filter: /nodepack-vendor-dummy/ }, (args) => {
        return build.resolve(vendor, {
          importer: args.importer,
          kind: args.kind,
          namespace: args.namespace,
          resolveDir: args.resolveDir,
        });
      });

      build.onResolve({ filter: /.*/ }, async (args) => {
        if (args.path === "nodepack-vendor-dummy" || args.path === vendor) {
          return;
        }

        const originalPath = args.path;
        args = { ...args };

        const replaceWith = importReplace.get(args.path);
        if (replaceWith) {
          if (replaceWith.startsWith(".")) {
            const fromOutfileToReplacement = path.relative(
              path.dirname(outfile),
              path.resolve(srcDir, replaceWith)
            );
            args.path = fromOutfileToReplacement;
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
            path: asRelative(`${args.path}${outExt}`),
          };
        }

        return {
          path: path.isAbsolute(args.path)
            ? args.path
            : path.resolve(args.resolveDir, args.path),
        };
      });
    },
  };
};
