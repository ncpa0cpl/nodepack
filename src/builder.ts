import esbuild from "esbuild";
import fs from "fs/promises";
import path from "path";
import type { ProgramContext } from "./program";
import { changeExt } from "./utilities/change-ext";
import { ESbuildPlugin } from "./utilities/esbuild-plugin";
import { loadFooterBanner } from "./utilities/load-footer-banner";
import { replaceNameVars } from "./utilities/replace-name-vars";
import { VendorBuilder } from "./vendor-builder";

export class Builder {
  private cjsBuildDir: string;
  private esmBuildDir: string;
  private legacyBuildDir: string;
  public vendorBuilder: VendorBuilder;

  constructor(
    private program: ProgramContext,
    private srcDir: string,
    outDir: string,
  ) {
    if (this.program.config.get("noDirScoping", false)) {
      this.cjsBuildDir = outDir;
      this.esmBuildDir = outDir;
      this.legacyBuildDir = outDir;
    } else {
      this.cjsBuildDir = path.resolve(outDir, "cjs");
      this.esmBuildDir = path.resolve(outDir, "esm");
      this.legacyBuildDir = path.resolve(outDir, "legacy");
    }
    this.vendorBuilder = new VendorBuilder(program, srcDir, outDir);
  }

  withMappedExt(fpath: string, ext: string) {
    const extMapper = this.program.extMap.withFormat(ext);
    const inputExt = path.extname(fpath);
    const outExt = extMapper.hasMapping(inputExt)
      ? extMapper.map(inputExt)
      : ext;
    return changeExt(fpath, outExt);
  }

  resolveOutFile(
    outDir: string,
    input: string,
    ext: string,
  ) {
    const srcDir = this.srcDir;
    const outFilePath = path.join(
      outDir,
      path.relative(srcDir, input),
    );
    return this.withMappedExt(outFilePath, ext);
  }

  private async buildFile(
    actualFilePath: string,
    originalFilePath: string,
    outDir: string,
    format: "cjs" | "esm" | "legacy",
    bundle = false,
  ) {
    const {
      plugins: additionalPlugins = [],
      external: _,
      ...additionalOptions
    } = this.program.config.get("esbuildOptions", {});

    let esformat: esbuild.Format;
    let ext: string;

    switch (format) {
      case "cjs":
        esformat = "cjs";
        ext = ".cjs";
        break;
      case "esm":
        esformat = "esm";
        ext = ".mjs";
        break;
      case "legacy":
        esformat = "cjs";
        ext = ".js";
        break;
    }

    const extMapper = this.program.extMap.withFormat(ext);

    const outfile = this.resolveOutFile(outDir, originalFilePath, ext);
    const outExt = path.extname(outfile);

    const footerBannerOptions = await this.resolveFootersBanners(
      actualFilePath,
      esformat,
      bundle,
    );

    await esbuild.build({
      ...additionalOptions,
      ...footerBannerOptions,
      entryPoints: [actualFilePath],
      outfile,
      target: this.program.config.get("target"),
      tsconfig: this.program.config.get("tsConfig"),
      bundle: true,
      format: esformat,
      plugins: [
        ...additionalPlugins,
        ESbuildPlugin({
          builder: this,
          program: this.program,
          vendorBuilder: this.vendorBuilder,
          extMapper,
          srcDir: this.srcDir,
          outDir,
          outfile,
          outExt,
          bundle,
          format,
        }),
      ],
      outExtension: { ".js": outExt },
    });

    const bundleOutfile = this.program.config.get("bundleOutfile");
    if (bundle && bundleOutfile) {
      let newName = await replaceNameVars(
        bundleOutfile,
        path.basename(outfile, path.extname(outfile)),
        outfile,
      );

      if (newName != path.basename(outfile)) {
        const newPath = path.join(path.dirname(outfile), newName);
        await fs.mkdir(path.dirname(newPath), { recursive: true });
        await fs.rename(outfile, newPath);
        return newPath;
      }
    }

    return outfile;
  }

  private async resolveFootersBanners(
    filepath: string,
    format: esbuild.BuildOptions["format"],
    bundle: boolean,
  ): Promise<{
    footer: Record<string, string>;
    banner: Record<string, string>;
  }> {
    if (bundle) {
      const footers = await Promise.all(
        Object.values(this.program.config.get("footer", {})).map((f) =>
          loadFooterBanner(this.program, format, f)
        ),
      );
      const banners = await Promise.all(
        Object.values(this.program.config.get("banner", {})).map((f) =>
          loadFooterBanner(this.program, format, f)
        ),
      );

      return {
        footer: footers.length ? { js: footers.join("\n") } : {},
        banner: banners.length ? { js: banners.join("\n") } : {},
      };
    } else {
      const footerAndBanner = this.program.config.getFooterBanner(filepath);

      const footer = footerAndBanner.footer
        ? await loadFooterBanner(this.program, format, footerAndBanner.footer)
        : undefined;

      const banner = footerAndBanner.banner
        ? await loadFooterBanner(this.program, format, footerAndBanner.banner)
        : undefined;

      return {
        footer: footer ? { js: footer } : {},
        banner: banner ? { js: banner } : {},
      };
    }
  }

  private resolveIsomorphicImport(
    filePath: string,
    format: "cjs" | "esm" | "legacy",
  ) {
    const relativeToSrc = path.relative(this.srcDir, filePath);

    if (this.program.isomorphicImports.isIsomorphic(relativeToSrc)) {
      const replacement = this.program.isomorphicImports.resolve(
        relativeToSrc,
        format,
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
        true,
      );
    }

    if (format === "esm") {
      return this.buildFile(
        isomorphicPath,
        filePath,
        this.esmBuildDir,
        "esm",
        true,
      );
    }

    if (format === "legacy") {
      return this.buildFile(
        isomorphicPath,
        filePath,
        this.legacyBuildDir,
        "legacy",
        true,
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
      );
    }

    if (format === "esm") {
      return this.buildFile(
        isomorphicPath,
        filePath,
        this.esmBuildDir,
        "esm",
      );
    }

    if (format === "legacy") {
      return this.buildFile(
        isomorphicPath,
        filePath,
        this.legacyBuildDir,
        "legacy",
      );
    }

    throw Error("Impossible scenario.");
  }

  private async watchFile(
    actualFilePath: string,
    originalFilePath: string,
    outDir: string,
    format: "cjs" | "esm" | "legacy",
  ) {
    const { plugins: additionalPlugins = [], ...additionalOptions } = this
      .program.config.get("esbuildOptions", {});

    let esformat: esbuild.Format;
    let ext: string;

    switch (format) {
      case "cjs":
        esformat = "cjs";
        ext = ".cjs";
        break;
      case "esm":
        esformat = "esm";
        ext = ".mjs";
        break;
      case "legacy":
        esformat = "cjs";
        ext = ".js";
        break;
    }

    const outFilePath = path.join(
      outDir,
      path.relative(this.srcDir, originalFilePath),
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
      target: this.program.config.get("target"),
      tsconfig: this.program.config.get("tsConfig"),
      bundle: true,
      format: esformat,
      plugins: [
        ...additionalPlugins,
        ESbuildPlugin({
          builder: this,
          program: this.program,
          vendorBuilder: this.vendorBuilder,
          extMapper,
          srcDir: this.srcDir,
          outDir,
          outfile,
          outExt,
          bundle: false,
          format,
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
      );
    }

    if (format === "esm") {
      return this.watchFile(
        isomorphicPath,
        filePath,
        this.esmBuildDir,
        "esm",
      );
    }

    if (format === "legacy") {
      return this.watchFile(
        isomorphicPath,
        filePath,
        this.legacyBuildDir,
        "legacy",
      );
    }

    throw Error("Impossible scenario.");
  }
}
