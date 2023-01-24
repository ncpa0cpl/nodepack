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
    actualFilePath: string,
    originalFilePath: string,
    outDir: string,
    format: esbuild.BuildOptions["format"],
    ext: string
  ) {
    const { plugins: additionalPlugins = [], ...additionalOptions } =
      this.program.buildConfig.esbuildOptions ?? {};

    const outFilePath = path.join(
      outDir,
      path.relative(this.srcDir, originalFilePath)
    );

    const extMapper = this.program.extMap.withFormat(ext);

    const inputExt = path.extname(actualFilePath);
    const outExt = extMapper.hasMapping(inputExt)
      ? extMapper.map(inputExt)
      : ext;

    const r = await esbuild.build({
      ...additionalOptions,
      entryPoints: [actualFilePath],
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

  private resolveIsomorphicImport(
    filePath: string,
    format: "cjs" | "esm" | "legacy"
  ) {
    const relativeToSrc = path.relative(this.srcDir, filePath);

    if (this.program.isomorphicImports.isIsomorphic(relativeToSrc)) {
      const replacement = this.program.isomorphicImports.resolve(
        relativeToSrc,
        format
      );

      return path.resolve(this.srcDir, replacement);
    }

    return filePath;
  }

  async build(filePath: string, format: "cjs" | "esm" | "legacy") {
    const isomorphicPath = this.resolveIsomorphicImport(filePath, format);

    if (format === "cjs") {
      return this.buildFile(
        isomorphicPath,
        filePath,
        this.cjsBuildDir,
        "cjs",
        ".cjs"
      );
    }

    if (format === "esm") {
      return this.buildFile(
        isomorphicPath,
        filePath,
        this.esmBuildDir,
        "esm",
        ".mjs"
      );
    }

    if (format === "legacy") {
      return this.buildFile(
        isomorphicPath,
        filePath,
        this.legacyBuildDir,
        "cjs",
        ".js"
      );
    }

    throw Error("Impossible scenario.");
  }

  private async watchFile(
    actualFilePath: string,
    originalFilePath: string,
    outDir: string,
    format: esbuild.BuildOptions["format"],
    ext: string
  ) {
    const { plugins: additionalPlugins = [], ...additionalOptions } =
      this.program.buildConfig.esbuildOptions ?? {};

    const outFilePath = path.join(
      outDir,
      path.relative(this.srcDir, originalFilePath)
    );

    const extMapper = this.program.extMap.withFormat(ext);

    const inputExt = path.extname(actualFilePath);
    const outExt = extMapper.hasMapping(inputExt)
      ? extMapper.map(inputExt)
      : ext;

    const buildContext = await esbuild.context({
      ...additionalOptions,
      entryPoints: [actualFilePath],
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

    return {
      buildContext,
      awaiter: buildContext.watch(),
    };
  }

  watch(filePath: string, format: "cjs" | "esm" | "legacy") {
    const isomorphicPath = this.resolveIsomorphicImport(filePath, format);

    if (format === "cjs") {
      return this.watchFile(
        isomorphicPath,
        filePath,
        this.cjsBuildDir,
        "cjs",
        ".cjs"
      );
    }

    if (format === "esm") {
      return this.watchFile(
        isomorphicPath,
        filePath,
        this.esmBuildDir,
        "esm",
        ".mjs"
      );
    }

    if (format === "legacy") {
      return this.watchFile(
        isomorphicPath,
        filePath,
        this.legacyBuildDir,
        "cjs",
        ".js"
      );
    }

    throw Error("Impossible scenario.");
  }
}
