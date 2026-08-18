import crc from "crc-32";
import fs from "fs/promises";
import path from "path";

export async function replaceNameVars(
  pattern: string,
  name: string,
  filepath: string,
) {
  if (pattern.includes("[hash]")) {
    const hash = crc
      .buf((await fs.readFile(filepath)) as Uint8Array)
      .toString(32)
      .replace(/[^a-zA-Z0-9]/g, "");

    pattern = pattern.replaceAll("[hash]", hash);
  }

  if (pattern.includes("[name]")) {
    pattern = pattern.replaceAll("[name]", name);
  }

  if (pattern.includes("[ext]")) {
    pattern = pattern.replaceAll("[ext]", path.extname(filepath));
  }

  return pattern;
}
