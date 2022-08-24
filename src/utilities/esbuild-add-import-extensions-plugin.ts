import type esbuild from "esbuild";

export const ESbuildAddImportExtensionsPlugin = (ext: string) => ({
  name: "esbuild-esm-import-plugin",
  setup(build: esbuild.PluginBuild) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.importer) {
        if (args.path.startsWith("."))
          return { path: args.path + ext, external: true };
        else
          return {
            path: args.path,
            external: true,
          };
      }
    });
  },
});
