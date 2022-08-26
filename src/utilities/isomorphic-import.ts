/* eslint-disable @typescript-eslint/no-require-imports */
export const isomorphicImport = async (pkg: string) => {
  const isCommonJS = typeof module !== "undefined";

  if (isCommonJS) {
    // @ts-ignore
    return require(pkg);
  } else {
    // @ts-ignore
    return (await import(pkg)).default;
  }
};
