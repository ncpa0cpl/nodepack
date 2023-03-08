export type ExtMapping = Record<`.${string}`, `.${string}` | "%FORMAT%">;
export type PathAliasMap = Record<`${string}/*`, `./${string}/*` | "./*">;

export const isValidExtension = (ext: any) => {
  if (typeof ext !== "string") return false;
  return ext.startsWith(".") && ext.length > 1;
};

export const isValidExtMapping = (
  extMapping: unknown
): extMapping is ExtMapping => {
  if (typeof extMapping === "object" && extMapping !== null) {
    for (const [key, value] of Object.entries(extMapping)) {
      if (!isValidExtension(key)) return false;
      if (!isValidExtension(value) && value !== "%FORMAT%") return false;
    }
  }
  return true;
};

export const isRelative = (path: unknown): path is `./${string}` => {
  if (typeof path !== "string") return false;
  return path.startsWith("./");
};

export const isValidPathAliasMap = (map: unknown): map is PathAliasMap => {
  if (typeof map === "object" && map !== null) {
    for (const [key, value] of Object.entries(map)) {
      if (!key.endsWith("/*")) return false;
      if (!isRelative(value)) return false;
      if (!value.endsWith("/*")) return false;
    }
    return true;
  }
  return false;
};

export const isRecordWithRelativeKeys = (
  r: unknown
): r is Record<string, {}> => {
  if (typeof r === "object" && r !== null) {
    return Object.keys(r).every((key) => isRelative(key));
  }
  return false;
};
