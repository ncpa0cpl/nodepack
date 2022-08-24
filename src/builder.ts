import esbuild from "esbuild";
import path from "path";
import type { BuildConfig } from ".";
import { changeExt } from "./utilities/change-ext";
import { ESbuildAddImportExtensionsPlugin } from "./utilities/esbuild-add-import-extensions-plugin";

export class Builder {
  cjsBuildDir: string;
  esmBuildDir: string;
  legacyBuildDir: string;

  isCjs = false;
  isEsm = false;
  isLegacy = false;
  target: esbuild.BuildOptions["target"] = "es6";
  tsConfig: string | undefined;
  additionalESbuildOptions: esbuild.BuildOptions | undefined;

  constructor(public srcDir: string, outDir: string) {
    this.cjsBuildDir = path.resolve(outDir, "cjs");
    this.esmBuildDir = path.resolve(outDir, "esm");
    this.legacyBuildDir = path.resolve(outDir, "legacy");
  }

  private async buildFile(
    filePath: string,
    outDir: string,
    format: esbuild.BuildOptions["format"],
    ext: string
  ) {
    const { plugins: additionalPlugins = [], ...additionalOptions } =
      this.additionalESbuildOptions ?? {};

    const relativePath = path.relative(this.srcDir, filePath);
    const outFilePath = path.join(outDir, relativePath);

    return esbuild.build({
      ...additionalOptions,
      entryPoints: [filePath],
      outfile: changeExt(outFilePath, ext),
      target: this.target,
      tsconfig: this.tsConfig,
      bundle: true,
      format,
      plugins: [ESbuildAddImportExtensionsPlugin(ext), ...additionalPlugins],
      outExtension: {
        ".js": ext,
      },
    });
  }

  setFormats(formats: Required<BuildConfig>["formats"]) {
    this.isCjs = formats.includes("commonjs") || formats.includes("cjs");
    this.isEsm = formats.includes("esmodules") || formats.includes("esm");
    this.isLegacy = formats.includes("legacy");
  }

  async build(filePath: string) {
    const ops: Promise<any>[] = [];

    if (this.isCjs) {
      ops.push(this.buildFile(filePath, this.cjsBuildDir, "cjs", ".cjs"));
    }

    if (this.isEsm) {
      ops.push(this.buildFile(filePath, this.esmBuildDir, "esm", ".mjs"));
    }

    if (this.isLegacy) {
      ops.push(this.buildFile(filePath, this.legacyBuildDir, "cjs", ".js"));
    }

    return Promise.all(ops);
  }
}
