class Import {
  constructor(private importPath: string, private quotationMark: string) {}

  getPath() {
    return this.importPath;
  }

  /** Replaces the path of the import. */
  replace(replacement: string) {
    this.importPath = replacement;
  }

  toString() {
    return `import(${this.quotationMark}${this.importPath}${this.quotationMark})`;
  }
}

export class CodeLine {
  private lineParts: Array<string | Import> = [""];

  constructor(public readonly line: string) {
    this.parse();
  }

  private findImportPositions(
    line: string
  ): Array<[start: number, end: number]> {
    const startPositions: Array<number> = [];

    let p = -1;
    while (
      (p = line.indexOf(
        'import("',
        startPositions[startPositions.length - 1]! + 1
      )) !== -1
    ) {
      startPositions.push(p);
    }

    const positions: Array<[start: number, end: number]> = [];

    for (const start of startPositions) {
      const end = line.indexOf('")', start);
      positions.push([start, end + 2]);
    }

    return positions;
  }

  private parse() {
    const positions = this.findImportPositions(this.line);

    let s = 0;
    for (const [start, end] of positions) {
      this.lineParts.push(this.line.slice(s, start));
      this.lineParts.push(
        new Import(
          this.line.slice(start + 8, end - 2),
          this.line.slice(start + 7, start + 8)
        )
      );
      s = end;
    }
    this.lineParts.push(this.line.slice(s));
  }

  get imports(): Array<Import> {
    return this.lineParts.filter(
      (part): part is Import => typeof part === "object"
    );
  }

  toString(): string {
    return this.lineParts.map((p) => p.toString()).join("");
  }
}
