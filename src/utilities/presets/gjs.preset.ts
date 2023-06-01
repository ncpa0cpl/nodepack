import type { BuildConfig } from "../../build-config-type";

export const gjsPreset = {
  external: [/^gi?:\/\/.+/, "console", "gettext", "gi", "system"],
} satisfies Partial<BuildConfig>;
