import ts from "typescript";
import type { NodePackScriptTarget } from "..";

export const mapCompilerTarget = (
  target: NodePackScriptTarget
): ts.ScriptTarget => {
  switch (target) {
    case "es2022":
      return ts.ScriptTarget.ES2022;
    case "es2021":
      return ts.ScriptTarget.ES2021;
    case "es2020":
      return ts.ScriptTarget.ES2020;
    case "es2019":
      return ts.ScriptTarget.ES2019;
    case "es2018":
      return ts.ScriptTarget.ES2018;
    case "es2017":
      return ts.ScriptTarget.ES2017;
    case "es2016":
      return ts.ScriptTarget.ES2016;
    case "es2015":
      return ts.ScriptTarget.ES2015;
    case "es5":
      return ts.ScriptTarget.ES5;
    case "es3":
      return ts.ScriptTarget.ES3;
    case "es6":
      return ts.ScriptTarget.ES2015;
    case "ESNext":
      return ts.ScriptTarget.ESNext;
    default:
      throw new Error(`Unknown target: ${target}`);
  }
};
