export function endsWith(str: string, ...suffixes: string[]) {
  for (const suffix of suffixes) {
    if (str.endsWith(suffix)) {
      return true;
    }
  }
  return false;
}
