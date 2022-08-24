import path from "path";

export const changeExt = (file: string, ext: string) => {
  const p = path.parse(file);
  return path.join(p.dir, p.name + ext);
};
