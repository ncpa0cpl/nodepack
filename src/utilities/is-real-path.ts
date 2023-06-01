import fsc from "fs";
import fs from "fs/promises";
import { CacheMap } from "./info-cache";

const resultCache = new CacheMap<boolean>();

export const fileExists = async (path: string) => {
  const cachedResult = resultCache.get(path);
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  try {
    await fs.access(path, fsc.constants.R_OK);
    resultCache.set(path, true);
    return true;
  } catch {
    resultCache.set(path, false);
    return false;
  }
};
