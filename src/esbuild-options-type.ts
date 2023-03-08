import type esbuild from "esbuild";

export type ESBuildOptions = Omit<
  esbuild.BuildOptions,
  | "entryPoints"
  | "outfile"
  | "outdir"
  | "outbase"
  | "target"
  | "tsconfig"
  | "bundle"
  | "format"
  | "outExtension"
  | "absWorkingDir"
  | "watch"
>;
