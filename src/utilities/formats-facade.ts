import type { BuildConfig } from "../build-config-type";

export class FormatsFacade {
  readonly isCjs: boolean;
  readonly isEsm: boolean;
  readonly isLegacy: boolean;

  constructor(formats: Required<BuildConfig>["formats"]) {
    this.isCjs = formats.includes("commonjs") || formats.includes("cjs");
    this.isEsm = formats.includes("esmodules") || formats.includes("esm");
    this.isLegacy = formats.includes("legacy");
  }
}
