export class ExcludeFacade {
  private readonly exclude: RegExp[];

  constructor(exclude: RegExp | Array<RegExp>) {
    this.exclude = Array.isArray(exclude) ? exclude : [exclude];
  }

  isNotExcluded(filePath: string): boolean {
    return !this.exclude.some((r) => r.test(filePath));
  }
}
