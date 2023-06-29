import type { ts } from "@ts-morph/bootstrap";
import esbuild from "esbuild";
import { readFile } from "fs/promises";
import path from "path";
import type { ProgramContext } from "../program";
import type { FooterBanner } from "./config-helper";

export const loadFooterBanner = async (
  program: ProgramContext,
  format: esbuild.BuildOptions["format"],
  footerBanner: FooterBanner
) => {
  const tsOptions: Partial<ts.CompilerOptions> = {
    target: 2, // ES2015
    experimentalDecorators: program.config.get("decoratorsMetadata", false),
    emitDecoratorMetadata: program.config.get("decoratorsMetadata", false),
    strict: false,
    skipLibCheck: true,
    downlevelIteration: true,
    esModuleInterop: true,
    module: format === "esm" ? 7 : 1,
    moduleResolution: 2, // NodeJs
  };

  if ("text" in footerBanner) {
    switch (footerBanner.loader) {
      case "typescript":
        return await program.tsProgram.parseFile({
          filePath: "footer-or-banner.ts",
          fileContent: footerBanner.text,
          compilerOptions: tsOptions,
        });
      case "esbuild":
        return await esbuild
          .transform(footerBanner.text, {
            target: program.config.get("target"),
            loader: "ts",
            format,
          })
          .then((r) => r.code);
      default:
        return footerBanner.text;
    }
  } else {
    const srcdir = program.config.get("srcDir");
    const fileContent = await readFile(
      path.resolve(srcdir, footerBanner.file),
      "utf-8"
    );

    switch (footerBanner.loader) {
      case "copy":
        return fileContent;
      case "typescript":
        return await program.tsProgram.parseFile({
          filePath: path.basename(footerBanner.file),
          fileContent: fileContent,
          compilerOptions: tsOptions,
        });
      default:
        return await esbuild
          .transform(fileContent, {
            target: program.config.get("target"),
            loader: "ts",
            format,
          })
          .then((r) => r.code);
    }
  }
};
