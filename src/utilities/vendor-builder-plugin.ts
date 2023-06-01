import type esbuild from "esbuild";
import path from "path";
import type { ProgramContext } from "../program";
import type { VendorBuilder } from "../vendor-builder";
import { asRelative } from "./as-relative";

export const VendorBuilderPlugin = (params: {
  program: ProgramContext;
  vendorBuilder: VendorBuilder;
  vendor: string;
  srcDir: string;
  outfile: string;
  outExt: string;
}): esbuild.Plugin => {
  const { vendorBuilder, program, vendor, outfile, srcDir, outExt } = params;

  const vendors = program.config.get("compileVendors");
  const importReplace = new Map(
    Object.entries(program.config.get("replaceImports") ?? {})
  );

  const onVendorFound =
    vendors === "all"
      ? (vendor: string) => {
          vendorBuilder.addVendors([vendor]);
        }
      : (_: string) => {};

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

        if (program.config.isExternal(originalPath)) {
          return {
            external: true,
            path: args.path,
          };
        }

        if (program.config.isVendor(args.path)) {
          onVendorFound(args.path);
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
