import fs from "fs/promises";
import { CacheMap } from "./info-cache";

const resultCache = new CacheMap<boolean>();

export const isDirectory = async (path: string) => {
  const cachedResult = resultCache.get(path);
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  try {
    const stat = await fs.stat(path);
    resultCache.set(path, stat.isDirectory());
    return stat.isDirectory();
  } catch {
    resultCache.set(path, false);
    return false;
  }
};
