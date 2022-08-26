export const JS_EXTENSIONS = [
  ".ts",
  ".js",
  ".cjs",
  ".mjs",
  ".mts",
  ".cts",
  ".tsx",
  ".jsx",
];

export const ESBUILD_SUPPORTED_EXTENSIONS = [".json", ".txt", ".data"];

export const PARSABLE_EXTENSIONS = [
  ...JS_EXTENSIONS,
  ...ESBUILD_SUPPORTED_EXTENSIONS,
];
