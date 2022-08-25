import path from "path";

export const ensureAbsolutePath = (filePath: string) => {
  if (!path.isAbsolute(filePath)) {
    throw new Error(`[${filePath}] is not an absolute path.`);
  }
};
