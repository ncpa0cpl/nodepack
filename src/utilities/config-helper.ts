import merge from "lodash.mergewith";
import path from "node:path";
import type { BuildConfig } from "../build-config-type";
import { asRelative } from "./as-relative";
import { denoPreset } from "./presets/deno.preset";
import { gjsPreset } from "./presets/gjs.preset";
import { nodePreset } from "./presets/node.preset";

export type FooterBanner = ValueOf<Defined<BuildConfig["banner"]>>;

type MergeWithCustomizer = {
  bivariantHack(
    value: any,
    srcValue: any,
    key: string,
    object: any,
    source: any,
  ): any;
}["bivariantHack"];

type Defined<T> = Exclude<T, undefined | null>;

type ValueOf<T extends object> = T[keyof T];

export class ConfigHelper {
  vendors = new Set<string>();

  constructor(private readonly config: BuildConfig) {
    if (Array.isArray(config.compileVendors)) {
      this.vendors = new Set(
        Array.from(config.compileVendors).flatMap(v =>
          typeof v === "string" ? v : v.vendors
        ),
      );
    }

    if (config.preset) {
      const presets: Partial<BuildConfig>[] = [];

      if (config.preset?.node === true) {
        presets.push(nodePreset);
      }

      if (config.preset?.deno === true) {
        presets.push(denoPreset);
      }

      if (config.preset.gjs) {
        presets.push(gjsPreset);
      }

      const mergeCustomizer: MergeWithCustomizer = (value, srcValue) => {
        if (Array.isArray(value)) {
          return value.concat(srcValue);
        }
      };

      this.config = merge(this.config, ...presets, mergeCustomizer);
    }

    const additionalExternal = config.esbuildOptions?.external ?? [];
    this.config.external = (config.external ?? []).concat(additionalExternal);
  }

  isSplitVendor(m: string) {
    if (m.startsWith("/") || m.startsWith(".")) {
      return false;
    }

    if (this.config.compileVendors === "all") {
      return true;
    }

    return this.vendors.has(m);
  }

  mapVendorImport(
    originalImport: string,
    outExt: string,
    relativeFrom?: {
      /** File from which this vendor will be imported */
      from: string;
      /** Path to the vendor directory */
      vendorDir: string;
    },
  ) {
    if (this.config.compileVendors == null) {
      throw new Error(
        "cannot map vendor import, compileVendors config option is not defined",
      );
    }

    if (this.config.compileVendors === "all") {
      return asRelative(`${originalImport}${outExt}`);
    }

    for (const e of this.config.compileVendors ?? []) {
      if (typeof e === "string") {
        if (e === originalImport) {
          if (relativeFrom) {
            const pth = path.join(
              relativeFrom.vendorDir,
              `${originalImport}${outExt}`,
            );
            return asRelative(path.relative(relativeFrom.from, pth));
          } else {
            return asRelative(`${originalImport}${outExt}`);
          }
        }
      } else {
        if (e.vendors.includes(originalImport)) {
          if (relativeFrom) {
            const pth = path.join(relativeFrom.vendorDir, `${e.name}${outExt}`);
            return asRelative(path.relative(relativeFrom.from, pth));
          } else {
            return asRelative(`${e.name}${outExt}`);
          }
        }
      }
    }

    throw new Error(
      `cannot map vendor import, '${originalImport}' is not a mapped vendor`,
    );
  }

  isExternal(m: string) {
    const externals = this.config.external ?? [];

    for (let i = 0; i < externals.length; i++) {
      const external = externals[i]!;

      if (typeof external === "string") {
        if (external === m) {
          return true;
        }
      } else {
        if (external.test(m)) {
          return true;
        }
      }
    }

    return false;
  }

  getFooterBanner(file: string) {
    const bannerMap = this.config.banner ?? {};
    const footerMap = this.config.footer ?? {};
    const bannerKeys = Object.keys(bannerMap);
    const footerKeys = Object.keys(footerMap);

    const result = {
      banner: null as null | FooterBanner,
      footer: null as null | FooterBanner,
    };

    for (const bannerKey of bannerKeys) {
      const regexp = new RegExp(bannerKey);
      if (regexp.test(file)) {
        result.banner = bannerMap[bannerKey]!;
      }
    }

    for (const footerKey of footerKeys) {
      const regexp = new RegExp(footerKey);
      if (regexp.test(file)) {
        result.footer = footerMap[footerKey]!;
      }
    }

    return result;
  }

  get<K extends keyof BuildConfig>(configProperty: K): BuildConfig[K];
  get<K extends keyof BuildConfig>(
    configProperty: K,
    defaultValue: BuildConfig[K],
  ): Defined<BuildConfig[K]>;
  get<K extends keyof BuildConfig>(
    configProperty: K,
    defaultValue?: BuildConfig[K],
  ) {
    return this.config[configProperty] ?? defaultValue;
  }
}
