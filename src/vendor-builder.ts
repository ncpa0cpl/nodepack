import esbuild from "esbuild";
import fs from "fs/promises";
import path from "path";
import { nodepackDir } from "./get-nodepack-dir/get-nodepack-dir";
import type { ProgramContext } from "./program";
import { asRelative } from "./utilities/as-relative";
import { loadFooterBanner } from "./utilities/load-footer-banner";
import { replaceNameVars } from "./utilities/replace-name-vars";
import { VendorBuilderPlugin } from "./utilities/vendor-builder-plugin";

type VendorBuildable = string | {
  name: string;
  outfile?: string;
  vendors: string[];
};

function vendorName(vendor: VendorBuildable): string {
  if (typeof vendor === "string") return vendor;
  return vendor.name;
}

export class VendorBuilder {
  private cjsBuildDir: string;
  private esmBuildDir: string;
  private legacyBuildDir: string;
  private buildJobs: Promise<any>[] = [];
  private jobsFinished = 0;

  private vendorImportOutputs = new Map<string, Promise<string>>();

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
  }

  private addJob(job: Promise<any>) {
    this.buildJobs.push(
      job.finally(() => {
        this.jobsFinished++;
      }),
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
    vendor: VendorBuildable,
    outDir: string,
    format: esbuild.BuildOptions["format"],
    ext: string,
  ): Promise<string> {
    const { plugins: additionalPlugins = [], ...additionalOptions } = this
      .program.config.get("esbuildOptions", {});

    const vendorDirPath = path.resolve(
      outDir,
      this.program.vendorsDir,
    );

    const outpath = path.join(
      vendorDirPath,
      `${vendorName(vendor)}${ext}`,
    );

    const entrypointFilepath = this.getVendorProxyFilePath(format);

    const footerBannerOptions = await this.resolveFootersBanners(
      vendorName(vendor),
      format,
    );

    await esbuild.build({
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
          vendorDirPath,
          vendorBuilder: this,
          vendorName: vendorName(vendor),
          entrypoints: typeof vendor === "string" ? [vendor] : vendor.vendors,
          srcDir: this.srcDir,
          outfile: outpath,
          outExt: ext,
        }),
      ],
      outExtension: { ".js": ext },
    });

    if (typeof vendor === "object" && vendor.outfile) {
      const newName = await replaceNameVars(
        vendor.outfile,
        vendor.name,
        outpath,
      );
      if (newName != path.basename(outpath)) {
        const newPath = path.join(path.dirname(outpath), newName);
        await fs.mkdir(path.dirname(newPath), { recursive: true });
        await fs.rename(outpath, newPath);
        return newPath;
      }
    }

    return outpath;
  }

  private async resolveFootersBanners(
    filepath: string,
    format: esbuild.BuildOptions["format"],
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

  private mapVendorsToBuildJob(
    vendors: VendorBuildable[],
    buildir: string,
    format: esbuild.BuildOptions["format"],
    ext: string,
  ) {
    return vendors.map((v) => {
      const op = this.buildVendorFile(v, buildir, format, ext);
      this.vendorImportOutputs.set(ext + ":" + vendorName(v), op);

      if (typeof v === "object") {
        v.vendors.forEach(vpkg => {
          this.vendorImportOutputs.set(ext + ":" + vpkg, op);
        });
      }

      return op;
    });
  }

  private buildVendors(
    vendors: VendorBuildable[],
    format: "cjs" | "esm" | "legacy",
  ) {
    if (format === "cjs") {
      return Promise.all(
        this.mapVendorsToBuildJob(vendors, this.cjsBuildDir, "cjs", ".cjs"),
      );
    }

    if (format === "esm") {
      return Promise.all(
        this.mapVendorsToBuildJob(vendors, this.esmBuildDir, "esm", ".mjs"),
      );
    }

    if (format === "legacy") {
      return Promise.all(
        this.mapVendorsToBuildJob(vendors, this.legacyBuildDir, "cjs", ".js"),
      );
    }

    throw new Error("Impossible scenario.");
  }

  private vendorsBuiltOrStarted = new Set<string>();

  public addVendors(vendors: VendorBuildable[]) {
    vendors = vendors.filter(v => {
      return !this.vendorsBuiltOrStarted.has(vendorName(v));
    });

    if (vendors.length === 0) return;

    for (const v of vendors) {
      this.vendorsBuiltOrStarted.add(vendorName(v));
    }

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

  async getImportForVendorPackage(
    vendor: string,
    ext: string,
    relativeFrom: string,
    vendorDir?: string,
  ) {
    const v = this.vendorImportOutputs.get(ext + ":" + vendor);
    if (v) {
      if (relativeFrom) {
        const pth = await v;
        return asRelative(path.relative(relativeFrom, pth));
      }

      return v;
    }
    return this.program.config.mapVendorImport(
      vendor,
      ext,
      vendorDir
        ? {
          vendorDir,
          from: relativeFrom,
        }
        : undefined,
    );
  }
}
