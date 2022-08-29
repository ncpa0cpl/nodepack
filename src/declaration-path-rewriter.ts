import fs from "fs/promises";
import { walk } from "node-os-walk";
import path from "path";
import { asRelative } from "./utilities/as-relative";
import type { PathAliasResolver } from "./utilities/path-alias-resolver";

export class DeclarationPathRewriter {
  constructor(
    private readonly typesDir: string,
    private readonly pathAliases: PathAliasResolver
  ) {}

  private rewriteImportLine(line: string, resolveDir: string): string {
    const [, , importPath] = line.match(/(import|export).+from\s"(.+?)"/) ?? [];

    if (importPath && this.pathAliases.isAlias(importPath)) {
      const absImportPath = path.resolve(
        this.typesDir,
        this.pathAliases.replaceAliasPattern(importPath)
      );
      const newImport = asRelative(path.relative(resolveDir, absImportPath));
      return line.replace(importPath, newImport);
    }

    return line;
  }

  private async rewriteImportInFile(filepath: string) {
    const content = await fs.readFile(filepath, "utf8");
    const lines = content.split("\n");
    for (const [index, line] of lines.entries()) {
      if (line.includes("import") || line.includes("export")) {
        const newLine = this.rewriteImportLine(line, path.dirname(filepath));
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
