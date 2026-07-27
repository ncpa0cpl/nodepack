import path from "path";
import type { BuildConfig } from "../build-config-type";
import { asRelative } from "./as-relative";

function isIndexFile(p: string) {
  return p.match(/index\.(?:tsx?|mtsx?|ctsx?|jsx?|mjsx?|cjsx?)$/);
}

const possibleIndexes = [
  "index.js",
  "index.mjs",
  "index.cjs",
  "index.jsx",
  "index.mjsx",
  "index.cjsx",
  "index.ts",
  "index.mts",
  "index.cts",
  "index.tsx",
  "index.mtsx",
  "index.ctsx",
];

export class IsomorphicImportsMapper {
  private isomorphicTargets = {
    cjs: new Set<string>(),
    esm: new Set<string>(),
    legacy: new Set<string>(),
  };

  constructor(
    private readonly isomorphicImports: Exclude<
      BuildConfig["isomorphicImports"],
      undefined
    >,
    private readonly srcDir: string,
  ) {
    for (const paths of Object.values(isomorphicImports)) {
      if (paths.cjs !== undefined) {
        this.isomorphicTargets.cjs.add(path.normalize(paths.cjs));
      }
      if (paths.mjs !== undefined) {
        this.isomorphicTargets.esm.add(path.normalize(paths.mjs));
      }
      if (paths.js !== undefined) {
        this.isomorphicTargets.legacy.add(path.normalize(paths.js));
      }
    }

    // normalize isomorphicImports keys
    const normalizedIsomorphicImports: typeof this.isomorphicImports = {};

    for (const [key, value] of Object.entries(isomorphicImports)) {
      normalizedIsomorphicImports[path.normalize(key) as `./${string}`] = value;
    }

    Object.assign(this.isomorphicImports, normalizedIsomorphicImports);
  }

  private getSelectedImportPath(
    paths: undefined | (typeof this.isomorphicImports)[`./${string}`],
    importPath: string,
    format: "cjs" | "esm" | "legacy",
  ) {
    if (path === undefined) {
      throw new Error(`No isomorphic import path found for ${importPath}`);
    }

    const resolvedPath = {
      cjs: paths?.cjs ?? importPath,
      esm: paths?.mjs ?? importPath,
      legacy: paths?.js ?? importPath,
    }[format];

    return resolvedPath;
  }

  public isIsomorphicTarget(importPath: string): boolean {
    const isAbsolute = path.isAbsolute(importPath);

    let relative: string;
    if (isAbsolute) {
      relative = path.relative(this.srcDir, importPath);
    } else {
      relative = path.normalize(importPath);
    }

    const isIsomporhpic = this.isomorphicTargets.cjs.has(relative)
      || this.isomorphicTargets.esm.has(relative)
      || this.isomorphicTargets.legacy.has(relative);
    return isIsomporhpic;
  }

  public isIsomorphic(importPath: string): boolean {
    const isAbsolute = path.isAbsolute(importPath);

    let relative: string;

    if (isAbsolute) {
      relative = asRelative(path.relative(this.srcDir, importPath));
    } else {
      relative = path.normalize(importPath);
    }

    if (isIndexFile(relative)) {
      return (
        this.isomorphicImports[relative] != null
        || this.isomorphicImports[path.dirname(relative)] != null
      );
    }

    return (
      this.isomorphicImports[relative] != null
      || possibleIndexes.some(indexName =>
        this.isomorphicImports[relative + "/" + indexName] != null
      )
    );
  }

  public targetFormats(
    isomorphicTarget: string,
  ): Array<"cjs" | "esm" | "legacy"> {
    const isAbsolute = path.isAbsolute(isomorphicTarget);

    let relative: string;
    if (isAbsolute) {
      relative = path.relative(this.srcDir, isomorphicTarget);
    } else {
      relative = path.normalize(isomorphicTarget);
    }

    const formats: Array<"cjs" | "esm" | "legacy"> = [];

    if (this.isomorphicTargets.cjs.has(relative)) {
      formats.push("cjs");
    }

    if (this.isomorphicTargets.esm.has(relative)) {
      formats.push("esm");
    }

    if (this.isomorphicTargets.legacy.has(relative)) {
      formats.push("legacy");
    }

    return formats;
  }

  public resolve(importPath: string, format: "cjs" | "esm" | "legacy"): string {
    const isAbsolute = path.isAbsolute(importPath);

    let relative: string;
    if (isAbsolute) {
      relative = asRelative(path.relative(this.srcDir, importPath));
    } else {
      relative = path.normalize(importPath);
    }

    const importPaths = this.isomorphicImports[relative];
    if (importPaths) {
      return this.getSelectedImportPath(importPaths, importPath, format);
    }

    if (isIndexFile(relative)) {
      const importPaths = this.isomorphicImports[path.dirname(relative)];
      if (importPaths) {
        return this.getSelectedImportPath(importPaths, importPath, format);
      }
    } else {
      for (const index of possibleIndexes) {
        const importPaths = this.isomorphicImports[relative + "/" + index];
        if (importPaths) {
          return this.getSelectedImportPath(importPaths, importPath, format);
        }
      }
    }

    throw new Error("cannot resolve, given path is not isomorphic");
  }
}
