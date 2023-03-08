import type { BuildConfig } from "../build-config-type";

export class PathAliasResolver {
  private readonly aliasList: Array<[pattern: string, aliasValue: string]> = [];

  constructor(private readonly pathAliases?: BuildConfig["pathAliases"]) {
    this.validatePathAliases();

    this.aliasList = Object.entries(this.pathAliases ?? {}).map(
      ([pattern, aliasValue]) => [
        pattern.replace(/\/\*$/, ""),
        aliasValue.replace(/\/\*$/, "").replace(/^.\//, ""),
      ]
    );
  }

  private validatePathAliases(): void {
    if (this.pathAliases)
      for (const [key, value] of Object.entries(this.pathAliases)) {
        if (!key.endsWith("/*")) {
          throw new Error(
            'Each path alias must end with a "/*", other patterns are not supported yet.'
          );
        }

        if (!value.startsWith("./") || !value.endsWith("/*")) {
          throw new Error(
            'Each path alias value must be have a "./" prefix and end with a "/*" suffix.'
          );
        }
      }
  }

  private getAliasFor(path: string): [string, string] {
    for (const [pattern, aliasValue] of this.aliasList) {
      if (path.startsWith(pattern)) return [pattern, aliasValue];
    }

    throw new Error(`No alias found for path: ${path}`);
  }

  isAlias(path: string): boolean {
    for (const [pattern] of this.aliasList) {
      if (path.startsWith(pattern)) return true;
    }

    return false;
  }

  replaceAliasPattern(path: string): string {
    const [pattern, aliasValue] = this.getAliasFor(path);
    return path.replace(pattern, aliasValue);
  }
}
