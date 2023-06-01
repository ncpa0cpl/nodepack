import merge from "lodash.mergewith";
import type { BuildConfig } from "../build-config-type";
import { denoPreset } from "./presets/deno.preset";
import { gjsPreset } from "./presets/gjs.preset";
import { nodePreset } from "./presets/node.preset";

type MergeWithCustomizer = {
  bivariantHack(
    value: any,
    srcValue: any,
    key: string,
    object: any,
    source: any
  ): any;
}["bivariantHack"];

type Defined<T> = Exclude<T, undefined | null>;

export class ConfigHelper {
  vendors = new Set<string>();

  constructor(private readonly config: BuildConfig) {
    if (Array.isArray(config.compileVendors)) {
      this.vendors = new Set(config.compileVendors);
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

  isVendor(m: string) {
    if (m.startsWith("/") || m.startsWith(".")) {
      return false;
    }

    if (this.config.compileVendors === "all") {
      return true;
    }

    return this.vendors.has(m);
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

  get<K extends keyof BuildConfig>(configProperty: K): BuildConfig[K];
  get<K extends keyof BuildConfig>(
    configProperty: K,
    defaultValue: BuildConfig[K]
  ): Defined<BuildConfig[K]>;
  get<K extends keyof BuildConfig>(
    configProperty: K,
    defaultValue?: BuildConfig[K]
  ) {
    return this.config[configProperty] ?? defaultValue;
  }
}
