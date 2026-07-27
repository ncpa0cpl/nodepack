import type { BuildConfig } from "../build-config-type";

enum ScriptTarget {
  ES2015 = 2,
  ES2016 = 3,
  ES2017 = 4,
  ES2018 = 5,
  ES2019 = 6,
  ES2020 = 7,
  ES2021 = 8,
  ES2022 = 9,
  ES2023 = 10,
  ES2024 = 11,
  ES2025 = 12,
  ESNext = 99,
  JSON = 100,
  Latest = 99,
}

export const mapCompilerTarget = (
  target: BuildConfig["target"],
): ScriptTarget => {
  switch (target) {
    case "es2022":
    case "ES2022":
      return ScriptTarget.ES2022;
    case "es2021":
    case "ES2021":
      return ScriptTarget.ES2021;
    case "es2020":
    case "ES2020":
      return ScriptTarget.ES2020;
    case "es2019":
    case "ES2019":
      return ScriptTarget.ES2019;
    case "es2018":
    case "ES2018":
      return ScriptTarget.ES2018;
    case "es2017":
    case "ES2017":
      return ScriptTarget.ES2017;
    case "es2016":
    case "ES2016":
      return ScriptTarget.ES2016;
    case "es2015":
    case "ES2015":
      return ScriptTarget.ES2015;
    case "es6":
    case "ES6":
      return ScriptTarget.ES2015;
    case "ESNext":
    case "esnext":
      return ScriptTarget.ESNext;
  }

  throw new Error(`Unknown target: ${target}`);
};
