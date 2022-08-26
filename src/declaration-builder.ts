/* eslint-disable @typescript-eslint/no-require-imports */
import type { ts } from "@ts-morph/bootstrap";
import { createProject } from "@ts-morph/bootstrap";
import fs from "fs/promises";
import { walk } from "node-os-walk";
import path from "path";
import type { NodePackScriptTarget } from ".";
import { isomorphicImport } from "./utilities/isomorphic-import";
import { mapCompilerTarget } from "./utilities/map-compiler-target";
export class DeclarationBuilder {
  outDir: string;
  target?: NodePackScriptTarget;
  tsConfigPath?: string;

  constructor(public srcDir: string, outDir: string) {
    this.outDir = path.join(outDir, "types");
  }

  private resolveCompilerOptions(): ts.CompilerOptions {
    const options: ts.CompilerOptions = {
      declaration: true,
      emitDeclarationOnly: true,
      rootDir: this.srcDir,
      outDir: this.outDir,
    };

    if (this.target) {
      options.target = mapCompilerTarget(this.target);
    }

    return options;
  }

  setTarget(target: NodePackScriptTarget) {
    this.target = target;
  }

  setTsConfig(filepath: string) {
    this.tsConfigPath = filepath;
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
    const project = await createProject({
      tsConfigFilePath: this.tsConfigPath,
      compilerOptions: this.resolveCompilerOptions(),
    });

    const program = project.createProgram();

    await program.emit(
      undefined,
      undefined,
      undefined,
      /* emitOnlyDtsFiles */ true
    );

    await this.buildJsonDeclarations();
  }
}
