import process from "node:process";
import path from "path";
import PrettyError from "pretty-error";
import type { BuildConfig } from "./build-config";
import { validateBuildConfig } from "./build-config";
import { Program } from "./program";
import { ensureAbsolutePath } from "./utilities/ensure-absolute-path";
export type { BuildConfig, NodePackScriptTarget } from "./build-config";

export async function build(config: BuildConfig) {
  let program: Program | undefined = undefined;

  try {
    console.log("Building...");

    config = validateBuildConfig(config);

    ensureAbsolutePath(config.srcDir);
    ensureAbsolutePath(config.outDir);
    if (config.tsConfig) {
      ensureAbsolutePath(config.tsConfig);
    }

    program = new Program(config);

    const ops: Promise<void>[] = [];

    if (config.declarations !== "only") {
      ops.push(program.transpileSource());
    }

    if (config.declarations === true || config.declarations === "only") {
      ops.push(program.emitDeclarations());
    }

    await Promise.all(ops);

    console.log("Build completed successfully.");
  } catch (error) {
    if (error instanceof Error) {
      const pe = new PrettyError()
        .removeAllAliases()
        .skip((line) => {
          return line.path ? line.path.startsWith("internal") : false;
        })
        .filter((line) => {
          line.shortenedAddr =
            "./" +
            path.relative(process.cwd(), line.addr.replace(/^file:\/\//, ""));
          return true;
        });

      const renderedError = pe.render(error);
      error.stack = renderedError;
    }
    throw error;
  } finally {
    program?.close();
  }
}
