import type { ts } from "@ts-morph/bootstrap";
import { createProject } from "@ts-morph/bootstrap";
import path from "path";
import type { NodePackScriptTarget } from ".";
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

  async build() {
    const project = await createProject({
      tsConfigFilePath: this.tsConfigPath,
      compilerOptions: this.resolveCompilerOptions(),
    });

    const program = project.createProgram();

    program.emit(undefined, undefined, undefined, /* emitOnlyDtsFiles */ true);
  }
}
