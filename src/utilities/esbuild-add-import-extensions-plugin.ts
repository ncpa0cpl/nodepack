import type esbuild from "esbuild";

export const ESbuildAddImportExtensionsPlugin = (ext: string) => ({
  name: "esbuild-esm-import-plugin",
  setup(build: esbuild.PluginBuild) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.importer) return { path: args.path + ext, external: true };
    });
  },
});
