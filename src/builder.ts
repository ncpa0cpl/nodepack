import esbuild from "esbuild";
import path from "path";
import type { BuildConfig, NodePackScriptTarget } from ".";
import { changeExt } from "./utilities/change-ext";
import { ESbuildPlugin } from "./utilities/esbuild-plugin";
import { ExtensionMapper } from "./utilities/extension-mapper";
import { PathAliasResolver } from "./utilities/path-alias-resolver";

export class Builder {
  cjsBuildDir: string;
  esmBuildDir: string;
  legacyBuildDir: string;

  isCjs = false;
  isEsm = false;
  isLegacy = false;
  target: NodePackScriptTarget = "es6";
  tsConfig: string | undefined;
  additionalESbuildOptions: esbuild.BuildOptions | undefined;
  extMapper = new ExtensionMapper({}, ".js");
  pathAliases = new PathAliasResolver();

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

    return esbuild.build({
      ...additionalOptions,
      entryPoints: [filePath],
      outfile: changeExt(outFilePath, ext),
      target: this.target,
      tsconfig: this.tsConfig,
      bundle: true,
      format,
      plugins: [
        ESbuildPlugin(extMapper, this.srcDir, this.pathAliases),
        ...additionalPlugins,
      ],
      outExtension: { ".js": ext },
    });
  }

  setOutExtensions(outExtensions: { [ext: string]: string }) {
    this.extMapper = new ExtensionMapper(outExtensions);
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
