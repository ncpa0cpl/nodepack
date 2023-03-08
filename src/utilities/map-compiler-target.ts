import ts from "typescript";
import type { BuildConfig } from "../build-config-type";

export const mapCompilerTarget = (
  target: BuildConfig["target"]
): ts.ScriptTarget => {
  switch (target) {
    case "es2022":
    case "ES2022":
      return ts.ScriptTarget.ES2022;
    case "es2021":
    case "ES2021":
      return ts.ScriptTarget.ES2021;
    case "es2020":
    case "ES2020":
      return ts.ScriptTarget.ES2020;
    case "es2019":
    case "ES2019":
      return ts.ScriptTarget.ES2019;
    case "es2018":
    case "ES2018":
      return ts.ScriptTarget.ES2018;
    case "es2017":
    case "ES2017":
      return ts.ScriptTarget.ES2017;
    case "es2016":
    case "ES2016":
      return ts.ScriptTarget.ES2016;
    case "es2015":
    case "ES2015":
      return ts.ScriptTarget.ES2015;
    case "es5":
    case "ES5":
      return ts.ScriptTarget.ES5;
    case "es3":
    case "ES3":
      return ts.ScriptTarget.ES3;
    case "es6":
    case "ES6":
      return ts.ScriptTarget.ES2015;
    case "ESNext":
    case "esnext":
      return ts.ScriptTarget.ESNext;
  }

  throw new Error(`Unknown target: ${target}`);
};
