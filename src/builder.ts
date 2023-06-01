import esbuild from "esbuild";
import path from "path";
import { nodepackDir } from "./get-nodepack-dir/get-nodepack-dir";
import type { ProgramContext } from "./program";
import { changeExt } from "./utilities/change-ext";
import { ESbuildPlugin } from "./utilities/esbuild-plugin";
import { VendorBuilderPlugin } from "./utilities/vendor-builder-plugin";

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

  private getVendorProxyFilePath(format: esbuild.BuildOptions["format"]) {
    switch (format) {
      case "esm":
        return path.resolve(nodepackDir, "vendor-proxy.mjs");
      default:
        return path.resolve(nodepackDir, "vendor-proxy.cjs");
    }
  }

  private async buildVendorFile(
    vendorName: string,
    outDir: string,
    format: esbuild.BuildOptions["format"],
    ext: string
  ) {
    const { plugins: additionalPlugins = [], ...additionalOptions } =
      this.program.buildConfig.esbuildOptions ?? {};

    const outpath = path.resolve(
      outDir,
      this.program.vendorsDir,
      `${vendorName}${ext}`
    );

    const r = await esbuild.build({
      ...additionalOptions,
      entryPoints: [this.getVendorProxyFilePath(format)],
      outfile: outpath,
      target: this.program.buildConfig.target,
      tsconfig: this.program.buildConfig.tsConfig,
      bundle: true,
      format,
      plugins: [
        ...additionalPlugins,
        VendorBuilderPlugin({
          program: this.program,
          vendor: vendorName,
          srcDir: this.srcDir,
          outfile: outpath,
          outExt: ext,
        }),
      ],
      outExtension: { ".js": ext },
    });

    return r;
  }

  private async buildFile(
    actualFilePath: string,
    originalFilePath: string,
    outDir: string,
    format: esbuild.BuildOptions["format"],
    ext: string,
    bundle = false
  ) {
    const {
      plugins: additionalPlugins = [],
      external: _,
      ...additionalOptions
    } = this.program.buildConfig.esbuildOptions ?? {};

    const outFilePath = path.join(
      outDir,
      path.relative(this.srcDir, originalFilePath)
    );

    const extMapper = this.program.extMap.withFormat(ext);

    const inputExt = path.extname(actualFilePath);
    const outExt = extMapper.hasMapping(inputExt)
      ? extMapper.map(inputExt)
      : ext;

    const outfile = changeExt(outFilePath, outExt);

    const r = await esbuild.build({
      ...additionalOptions,
      entryPoints: [actualFilePath],
      outfile,
      target: this.program.buildConfig.target,
      tsconfig: this.program.buildConfig.tsConfig,
      bundle: true,
      format,
      plugins: [
        ...additionalPlugins,
        ESbuildPlugin({
          program: this.program,
          extMapper,
          srcDir: this.srcDir,
          outDir,
          outfile,
          outExt,
          bundle,
        }),
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

  async bundle(filePath: string, format: "cjs" | "esm" | "legacy") {
    const isomorphicPath = this.resolveIsomorphicImport(filePath, format);

    if (format === "cjs") {
      return this.buildFile(
        isomorphicPath,
        filePath,
        this.cjsBuildDir,
        "cjs",
        ".cjs",
        true
      );
    }

    if (format === "esm") {
      return this.buildFile(
        isomorphicPath,
        filePath,
        this.esmBuildDir,
        "esm",
        ".mjs",
        true
      );
    }

    if (format === "legacy") {
      return this.buildFile(
        isomorphicPath,
        filePath,
        this.legacyBuildDir,
        "cjs",
        ".js",
        true
      );
    }

    throw Error("Impossible scenario.");
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

  async buildVendors(format: "cjs" | "esm" | "legacy") {
    const vendors = this.program.buildConfig.compileVendors ?? [];

    if (format === "cjs") {
      return Promise.all(
        vendors.map((v) =>
          this.buildVendorFile(v, this.cjsBuildDir, "cjs", ".cjs")
        )
      );
    }

    if (format === "esm") {
      return Promise.all(
        vendors.map((v) =>
          this.buildVendorFile(v, this.esmBuildDir, "esm", ".mjs")
        )
      );
    }

    if (format === "legacy") {
      return Promise.all(
        vendors.map((v) =>
          this.buildVendorFile(v, this.legacyBuildDir, "cjs", ".js")
        )
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

    const outfile = changeExt(outFilePath, outExt);

    const buildContext = await esbuild.context({
      ...additionalOptions,
      entryPoints: [actualFilePath],
      outfile,
      target: this.program.buildConfig.target,
      tsconfig: this.program.buildConfig.tsConfig,
      bundle: true,
      format,
      plugins: [
        ...additionalPlugins,
        ESbuildPlugin({
          program: this.program,
          extMapper,
          srcDir: this.srcDir,
          outDir,
          outfile,
          outExt,
          bundle: false,
        }),
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
