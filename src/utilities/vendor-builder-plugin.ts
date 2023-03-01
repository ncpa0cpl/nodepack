import type { Plugin } from "esbuild";

export const VendorBuilderPlugin = (vendor: string): Plugin => {
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
    },
  };
};
