import fs from "fs/promises";
import { walk } from "node-os-walk";
import path from "path";
import { asRelative } from "./utilities/as-relative";
import { CodeLine } from "./utilities/code-line";
import type { PathAliasResolver } from "./utilities/path-alias-resolver";

export class DeclarationPathRewriter {
  constructor(
    private readonly typesDir: string,
    private readonly pathAliases: PathAliasResolver
  ) {}

  /**
   * Checks if the provided import path contains an alias and if
   * so replaces it with the alias real path.
   */
  private rewritePath(importPath: string, resolveDir: string): string {
    if (this.pathAliases.isAlias(importPath)) {
      const absImportPath = path.resolve(
        this.typesDir,
        this.pathAliases.replaceAliasPattern(importPath)
      );
      const newImport = asRelative(path.relative(resolveDir, absImportPath));
      return newImport;
    }
    return importPath;
  }

  /**
   * Find all in-line import statements within the provided line,
   * and replaces all path aliases with the alias real paths.
   */
  private rewriteInlineImports(line: string, resolveDir: string) {
    const codeLine = new CodeLine(line);

    for (const _import of codeLine.imports) {
      const newPath = this.rewritePath(_import.getPath(), resolveDir);
      _import.replace(newPath);
    }

    return codeLine.toString();
  }

  /**
   * Find all import/export or inline statements within the
   * provided line, and replaces all path aliases with the alias
   * real paths.
   */
  private rewriteLine(line: string, resolveDir: string): string {
    const [, , importPath] =
      line.match(/(import|export).+?from\s+"(.+?)"/) ?? [];

    if (importPath && this.pathAliases.isAlias(importPath)) {
      const newImport = this.rewritePath(importPath, resolveDir);
      return line.replace(importPath, newImport);
    }

    return this.rewriteInlineImports(line, resolveDir);
  }

  /**
   * Find all import/export or inline statements within the
   * provided file, replaces all path aliases with the alias real
   * paths and saves the file.
   */
  private async rewriteImportInFile(filepath: string) {
    const content = await fs.readFile(filepath, "utf8");
    const lines = content.split("\n");
    for (const [index, line] of lines.entries()) {
      if (line.includes("import") || line.includes("export")) {
        const newLine = this.rewriteLine(line, path.dirname(filepath));
        lines[index] = newLine;
      }
    }
    await fs.writeFile(filepath, lines.join("\n"));
  }

  async rewrite() {
    const rewriteOperations: Promise<void>[] = [];

    for await (const [root, _, files] of walk(this.typesDir)) {
      for (const file of files) {
        if (file.name.endsWith(".d.ts")) {
          rewriteOperations.push(
            this.rewriteImportInFile(path.resolve(root, file.name))
          );
        }
      }
    }

    await Promise.all(rewriteOperations);
  }
}
