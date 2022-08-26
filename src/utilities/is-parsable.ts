import path from "path";
import { PARSABLE_EXTENSIONS } from "./parsable-extensions";

export const isParsable = (filePath: string): boolean => {
  if (!PARSABLE_EXTENSIONS.includes(path.extname(filePath).toLowerCase()))
    return false;

  return true;
};
