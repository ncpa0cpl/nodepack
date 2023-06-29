import esbuild from "esbuild";
import path from "path";
import { nodepackDir } from "./get-nodepack-dir/get-nodepack-dir";
import type { ProgramContext } from "./program";
import { loadFooterBanner } from "./utilities/load-footer-banner";
import { VendorBuilderPlugin } from "./utilities/vendor-builder-plugin";

export class VendorBuilder {
  private cjsBuildDir: string;
  private esmBuildDir: string;
  private legacyBuildDir: string;
  private buildJobs: Promise<any>[] = [];
  private jobsFinished = 0;

  constructor(
    private program: ProgramContext,
    private srcDir: string,
    outDir: string
  ) {
    this.cjsBuildDir = path.resolve(outDir, "cjs");
    this.esmBuildDir = path.resolve(outDir, "esm");
    this.legacyBuildDir = path.resolve(outDir, "legacy");
  }

  private addJob(job: Promise<any>) {
    this.buildJobs.push(
      job.finally(() => {
        this.jobsFinished++;
      })
    );
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
      this.program.config.get("esbuildOptions", {});

    const outpath = path.resolve(
      outDir,
      this.program.vendorsDir,
      `${vendorName}${ext}`
    );

    const entrypointFilepath = this.getVendorProxyFilePath(format);

    const footerBannerOptions = await this.resolveFootersBanners(
      vendorName,
      format
    );

    const r = await esbuild.build({
      ...additionalOptions,
      ...footerBannerOptions,
      entryPoints: [entrypointFilepath],
      outfile: outpath,
      target: this.program.config.get("target"),
      tsconfig: this.program.config.get("tsConfig"),
      bundle: true,
      format,
      plugins: [
        ...additionalPlugins,
        VendorBuilderPlugin({
          program: this.program,
          vendorBuilder: this,
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

  private async resolveFootersBanners(
    filepath: string,
    format: esbuild.BuildOptions["format"]
  ): Promise<{
    footer: Record<string, string>;
    banner: Record<string, string>;
  }> {
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

  private buildVendors(vendors: string[], format: "cjs" | "esm" | "legacy") {
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

  public addVendors(vendors: string[]) {
    if (this.program.formats.isEsm) {
      this.addJob(this.buildVendors(vendors, "esm"));
    }

    if (this.program.formats.isCjs) {
      this.addJob(this.buildVendors(vendors, "cjs"));
    }

    if (this.program.formats.isLegacy) {
      this.addJob(this.buildVendors(vendors, "legacy"));
    }
  }

  public async flush() {
    while (this.jobsFinished !== this.buildJobs.length) {
      await Promise.all(this.buildJobs);
    }
  }
}
