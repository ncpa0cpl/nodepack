import path from "path";
import { PARSABLE_EXTENSIONS } from "./parsable-extensions";

export const isParsable = (
  additionalParsableExtensions: string[],
  filePath: string
): boolean => {
  const normalizedExt = path.extname(filePath).toLowerCase();
  if (
    !PARSABLE_EXTENSIONS.includes(normalizedExt) &&
    !additionalParsableExtensions.includes(normalizedExt)
  ) {
    return false;
  }

  return true;
};
