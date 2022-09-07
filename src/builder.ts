import esbuild from "esbuild";
import path from "path";
import type { ProgramContext } from "./program";
import { changeExt } from "./utilities/change-ext";
import { ESbuildPlugin } from "./utilities/esbuild-plugin";

export class Builder {
  private cjsBuildDir: string;
  private esmBuildDir: string;
  private legacyBuildDir: string;

  constructor(
    private program: ProgramContext,
    private srcDir: string,
    outDir: string
  ) {
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
      this.program.buildConfig.esbuildOptions ?? {};

    const relativePath = path.relative(this.srcDir, filePath);
    const outFilePath = path.join(outDir, relativePath);

    const extMapper = this.program.extMap.withFormat(ext);

    const inputExt = path.extname(filePath);
    const outExt = extMapper.hasMapping(inputExt)
      ? extMapper.map(inputExt)
      : ext;

    const r = await esbuild.build({
      ...additionalOptions,
      entryPoints: [filePath],
      outfile: changeExt(outFilePath, outExt),
      target: this.program.buildConfig.target,
      tsconfig: this.program.buildConfig.tsConfig,
      bundle: true,
      format,
      plugins: [
        ...additionalPlugins,
        ESbuildPlugin(this.program, extMapper, this.srcDir),
      ],
      outExtension: { ".js": outExt },
    });

    return r;
  }

  async build(filePath: string, format: "cjs" | "esm" | "legacy") {
    if (format === "cjs") {
      return this.buildFile(filePath, this.cjsBuildDir, "cjs", ".cjs");
    }

    if (format === "esm") {
      return this.buildFile(filePath, this.esmBuildDir, "esm", ".mjs");
    }

    if (format === "legacy") {
      return this.buildFile(filePath, this.legacyBuildDir, "cjs", ".js");
    }
  }
}
