import path from "path";

export const changeExt = (file: string, ext: string) => {
  const p = path.parse(file);
  const result = path.join(p.dir, p.name + ext);

  if (file.startsWith("./")) {
    return `./${result}`;
  }
  return result;
};
