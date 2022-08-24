import path from "path";
import type { BuildConfig } from "..";
import { PARSABLE_EXTENSIONS } from "./parsable-extensions";

export const isParsable = (
  filePath: string,
  exclude: Required<BuildConfig>["exclude"]
): boolean => {
  const excludePatterns = Array.isArray(exclude) ? exclude : [exclude];

  if (!PARSABLE_EXTENSIONS.includes(path.extname(filePath))) return false;

  for (const excludePattern of excludePatterns) {
    if (excludePattern.test(filePath)) return false;
  }

  return true;
};
