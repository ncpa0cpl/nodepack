import type { BuildConfig } from "../../build-config-type";

export const denoPreset = {
  external: [/^http(s?):\/\/.+/, /^npm:.+/],
} satisfies Partial<BuildConfig>;
