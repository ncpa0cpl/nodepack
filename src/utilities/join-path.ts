const trimChar = (
  str: string,
  char: string,
  direction: "left" | "right"
): string => {
  const fromLeft = direction === "left";
  let result = str;

  while (
    result.length > 0 && fromLeft
      ? result.startsWith(char)
      : result.endsWith(char)
  ) {
    if (fromLeft) {
      result = result.slice(1);
    } else {
      result = result.slice(0, -1);
    }
  }

  return result;
};

const normalize = (path: string): string => {
  const parts = path.split("/");

  let i = 1;
  while (i < parts.length) {
    if (i > 0) {
      if (parts[i]!.startsWith(".")) {
        if (parts[i] == ".." && !parts[i - 1]!.startsWith(".")) {
          parts.splice(i - 1, 2);
          i--;
        } else if (parts[i] == ".") {
          parts.splice(i, 1);
        }
      } else {
        i++;
      }
    } else {
      i = 1;
    }
  }

  return parts.join("/");
};

export const joinPath = (start: string, ...parts: string[]): string => {
  let result = start;
  for (const p of parts) {
    result = trimChar(result, "/", "right") + "/" + trimChar(p, "/", "left");
  }
  return normalize(result);
};
