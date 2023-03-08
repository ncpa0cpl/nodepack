import path from "path";
import type { BuildConfig } from "../build-config-type";

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
    private readonly srcDir: string
  ) {
    for (const paths of Object.values(isomorphicImports)) {
      if (paths.cjs !== undefined)
        this.isomorphicTargets.cjs.add(path.normalize(paths.cjs));
      if (paths.mjs !== undefined)
        this.isomorphicTargets.esm.add(path.normalize(paths.mjs));
      if (paths.js !== undefined)
        this.isomorphicTargets.legacy.add(path.normalize(paths.js));
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
    format: "cjs" | "esm" | "legacy"
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

    if (isAbsolute) {
      const relative = path.relative(this.srcDir, importPath);
      return (
        this.isomorphicTargets.cjs.has(relative) ||
        this.isomorphicTargets.esm.has(relative) ||
        this.isomorphicTargets.legacy.has(relative)
      );
    } else {
      importPath = path.normalize(importPath);
      return (
        this.isomorphicTargets.cjs.has(importPath) ||
        this.isomorphicTargets.esm.has(importPath) ||
        this.isomorphicTargets.legacy.has(importPath)
      );
    }
  }

  public isIsomorphic(importPath: string): boolean {
    const isAbsolute = path.isAbsolute(importPath);

    if (isAbsolute) {
      const relative = ("./" +
        path.relative(this.srcDir, importPath)) as `./${string}`;
      return this.isomorphicImports[relative] !== undefined;
    } else {
      return (
        this.isomorphicImports[path.normalize(importPath) as `./${string}`] !==
        undefined
      );
    }
  }

  public resolve(importPath: string, format: "cjs" | "esm" | "legacy"): string {
    const isAbsolute = path.isAbsolute(importPath);

    if (isAbsolute) {
      const relative = ("./" +
        path.relative(this.srcDir, importPath)) as `./${string}`;
      const importPaths = this.isomorphicImports[relative];
      return this.getSelectedImportPath(importPaths, importPath, format);
    } else {
      const importPaths =
        this.isomorphicImports[path.normalize(importPath) as `./${string}`];
      return this.getSelectedImportPath(importPaths, importPath, format);
    }
  }
}
