export const asRelative = (path: string): string => {
  if (path.startsWith(".")) {
    return path;
  } else if (!path.startsWith("/")) {
    return "./" + path;
  }
  return path;
};
