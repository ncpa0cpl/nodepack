import type esbuild from "esbuild";
import path from "path";
import type { ProgramContext } from "../program";
import type { VendorBuilder } from "../vendor-builder";

export const VendorBuilderPlugin = (params: {
  program: ProgramContext;
  vendorBuilder: VendorBuilder;
  vendorDirPath: string;
  vendorName: string;
  entrypoints: string[];
  srcDir: string;
  outfile: string;
  outExt: string;
}): esbuild.Plugin => {
  const {
    vendorBuilder,
    program,
    vendorDirPath,
    entrypoints,
    outfile,
    srcDir,
    outExt,
  } = params;

  const vendors = program.config.get("compileVendors");
  const importReplace = new Map(
    Object.entries(program.config.get("replaceImports") ?? {}),
  );

  const onVendorFound = vendors === "all"
    ? (vendor: string) => {
      vendorBuilder.addVendors([vendor]);
    }
    : (_: string) => {};

  return {
    name: "nodepack-vendor-builder-plugin",
    setup(build) {
      const pkgs = entrypoints.map(pkg => {
        const replaceWith = importReplace.get(pkg);
        if (replaceWith) {
          if (replaceWith.startsWith(".")) {
            const fromOutfileToReplacement = path.relative(
              path.dirname(outfile),
              path.resolve(srcDir, replaceWith),
            );
            pkg = fromOutfileToReplacement;
          } else {
            pkg = replaceWith;
          }
        }

        return pkg;
      });

      build.onLoad({
        filter: /.*/,
        namespace: "nodepack-vendor-builder-plugin",
      }, () => {
        return {
          contents: pkgs.length > 1
            ? pkgs.map((pkg) => `export * from ${JSON.stringify(pkg)};\n`)
              .join("\n")
            : pkgs.map((pkg) =>
              `export * from ${JSON.stringify(pkg)};\n`
              + `import * as pkg from ${JSON.stringify(pkg)};\n`
              + `export default pkg.default ?? pkg;`
            )
              .join("\n"),

          loader: "ts",
          resolveDir: srcDir,
        };
      });

      build.onResolve({ filter: /.*/ }, async (args) => {
        if (
          typeof args.pluginData === "object" && args.pluginData != null
          && args.pluginData.evbpSkip === true
        ) {
          return;
        }

        if (args.path === "nodepack-vendor-dummy") {
          return {
            path: args.path,
            pluginName: "nodepack-vendor-builder-plugin",
            namespace: "nodepack-vendor-builder-plugin",
          };
        }

        const resolve = (pth: string) => {
          return build.resolve(pth, {
            importer: args.importer,
            kind: args.kind,
            namespace: args.namespace,
            resolveDir: args.resolveDir,
            pluginData: { evbpSkip: true },
          });
        };

        const originalPath = args.path;
        args = { ...args };

        const replaceWith = importReplace.get(args.path);
        if (replaceWith) {
          if (replaceWith.startsWith(".")) {
            const fromOutfileToReplacement = path.relative(
              path.dirname(outfile),
              path.resolve(srcDir, replaceWith),
            );
            args.path = fromOutfileToReplacement;
          } else {
            args.path = replaceWith;
          }
        }

        if (
          program.config.isExternal(originalPath)
          && !entrypoints.includes(originalPath)
          && !entrypoints.includes(args.path)
        ) {
          return {
            external: true,
            path: args.path,
          };
        }

        if (
          program.config.isSplitVendor(originalPath)
          && !entrypoints.includes(originalPath)
          && !entrypoints.includes(args.path)
        ) {
          onVendorFound(args.path);

          return {
            external: true,
            path: program.config.mapVendorImport(originalPath, outExt, {
              vendorDir: vendorDirPath,
              from: path.dirname(outfile),
            }),
          };
        }

        if (args.path === originalPath) {
          return resolve(args.path);
        }

        if (!args.path.startsWith(".") || args.path.startsWith("/")) {
          return resolve(
            path.isAbsolute(args.path)
              ? args.path
              : path.resolve(args.resolveDir, args.path),
          );
        }

        return resolve(args.path);
      });
    },
  };
};
