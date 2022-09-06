import esbuild from "esbuild";
import path from "path";
import type { NodePackScriptTarget } from ".";
import { changeExt } from "./utilities/change-ext";
import { ESbuildPlugin } from "./utilities/esbuild-plugin";
import { ExtensionMapper } from "./utilities/extension-mapper";
import { PathAliasResolver } from "./utilities/path-alias-resolver";

export class Builder {
  cjsBuildDir: string;
  esmBuildDir: string;
  legacyBuildDir: string;

  target: NodePackScriptTarget = "es6";
  tsConfig: string | undefined;
  additionalESbuildOptions: esbuild.BuildOptions | undefined;
  extMapper = new ExtensionMapper({}, ".js");
  pathAliases = new PathAliasResolver();
  decoratorsMetadata = false;

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

    const extMapper = this.extMapper.withFormat(ext);

    const inputExt = path.extname(filePath);
    const outExt = extMapper.hasMapping(inputExt)
      ? extMapper.map(inputExt)
      : ext;

    const r = await esbuild.build({
      ...additionalOptions,
      entryPoints: [filePath],
      outfile: changeExt(outFilePath, outExt),
      target: this.target,
      tsconfig: this.tsConfig,
      bundle: true,
      format,
      plugins: [
        ...additionalPlugins,
        ESbuildPlugin({
          extMapper,
          srcDir: this.srcDir,
          pathAliases: this.pathAliases,
          decoratorsMetadata: this.decoratorsMetadata,
          tsConfig: this.tsConfig,
        }),
      ],
      outExtension: { ".js": outExt },
    });

    return r;
  }

  setOutExtensions(outExtensions: { [ext: string]: string }) {
    this.extMapper = new ExtensionMapper(outExtensions);
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
