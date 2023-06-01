import esbuild from "esbuild";
import path from "path";
import { nodepackDir } from "./get-nodepack-dir/get-nodepack-dir";
import type { ProgramContext } from "./program";
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

    const r = await esbuild.build({
      ...additionalOptions,
      entryPoints: [this.getVendorProxyFilePath(format)],
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
