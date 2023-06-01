/* eslint-disable @typescript-eslint/no-require-imports */
import type { ts } from "@ts-morph/bootstrap";
import fs from "fs/promises";
import { walk } from "node-os-walk";
import path from "path";
import type { ProgramContext } from "./program";
import { isomorphicImport } from "./utilities/isomorphic-import";
import { mapCompilerTarget } from "./utilities/map-compiler-target";
export class DeclarationBuilder {
  private outDir: string;

  constructor(
    private program: ProgramContext,
    private srcDir: string,
    outDir: string
  ) {
    this.outDir = path.join(outDir, "types");
  }

  private resolveCompilerOptions(): ts.CompilerOptions {
    const options: ts.CompilerOptions = {
      declaration: true,
      emitDeclarationOnly: true,
      rootDir: this.srcDir,
      outDir: this.outDir,
    };

    if (this.program.config.get("target")) {
      options.target = mapCompilerTarget(this.program.config.get("target"));
    }

    return options;
  }

  private async buildJsonDeclarations() {
    let jsonToDts:
      | ((
          json: any,
          userOptions?: {
            rootName: string;
          }
        ) => string[])
      | undefined = undefined;

    try {
      jsonToDts = await isomorphicImport("json-to-ts");

      if (typeof jsonToDts !== "function") {
        throw new Error();
      }
    } catch (e) {
      console.warn(
        'Declarations for JSON files cannot be generated. Install the "json-to-ts" package to enable this feature.'
      );
      return;
    }

    const ops: Promise<any>[] = [];
    for await (const [root, , files] of walk(this.srcDir)) {
      for (const file of files) {
        const relativePath = path.relative(
          this.srcDir,
          path.join(root, file.name)
        );
        const outFilePath = path.join(this.outDir, relativePath);

        if (file.name.endsWith(".json")) {
          ops.push(
            fs
              .readFile(path.join(root, file.name), "utf8")
              .then(
                (content) =>
                  // @ts-ignore
                  jsonToDts(JSON.parse(content), {
                    rootName: "Default",
                  }).join("\n") + "\nexport default Default;"
              )
              .then((dt) => {
                fs.writeFile(outFilePath + ".d.ts", dt);
              })
          );
        }
      }
    }
    await Promise.all(ops);
  }

  async build() {
    await this.program.tsProgram.emitDeclarations({
      compilerOptions: this.resolveCompilerOptions(),
    });
    await this.buildJsonDeclarations();
  }

  getOutDir() {
    return this.outDir;
  }
}
