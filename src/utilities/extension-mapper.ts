export class ExtensionMapper {
  private readonly extMap: { [ext: string]: string };

  constructor(
    extMap: { [ext: string]: string },
    private readonly format?: string
  ) {
    const option = { ...extMap };

    if (this.format) {
      option[".js"] = this.format;
      option[".json"] = this.format;
      option[".txt"] = this.format;
      option[".data"] = this.format;
    }

    this.extMap = option;
  }

  withFormat(format: string): ExtensionMapper {
    return new ExtensionMapper(this.extMap, format);
  }

  hasMapping(ext: string): boolean {
    return this.extMap[ext] !== undefined;
  }

  map(ext: string): string {
    const mappedExt = this.extMap[ext] ?? ext;

    if (mappedExt === "%FORMAT%") {
      return this.format ?? ext;
    }

    return mappedExt;
  }
}
