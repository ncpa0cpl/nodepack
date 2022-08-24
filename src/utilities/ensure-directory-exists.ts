import fs from "fs";
import fsp from "fs/promises";

export const ensureDirectoryExists = (directory: string) => {
  if (!fs.existsSync(directory)) {
    return fsp.mkdir(directory);
  }
};
