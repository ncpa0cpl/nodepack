import { WorkerBridge } from "@ncpa0cpl/node-worker-bridge";
import { createProject, ts } from "@ts-morph/bootstrap";
import fs from "fs/promises";
import { ScriptTarget } from "../utilities/map-compiler-target";
import { ext } from "./get-ext";
import { dir } from "./get-workers-dir";

type MainThread = {
  getTsConfig(): Promise<string | undefined>;
};

export const TsProjectWorker = WorkerBridge(
  { file: `${dir}/ts-project-worker${ext}`, keepAlive: true },
  (main: MainThread) => {
    const getProject = async (
      decorators: "experimental" | "es",
      options?: Partial<ts.CompilerOptions>,
    ) => {
      return await createProject({
        tsConfigFilePath: await main.getTsConfig(),
        skipAddingFilesFromTsConfig: true,
        compilerOptions: {
          target: decorators === "experimental"
            ? ScriptTarget.ESNext
            : ScriptTarget.ES2022,
          experimentalDecorators: decorators === "experimental",
          emitDecoratorMetadata: decorators === "experimental",
          sourceMap: false,
          inlineSourceMap: true,
          inlineSources: true,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Node10,
          ...options,
        },
      });
    };

    const parseFile = async (params: {
      filePath: string;
      fileContent: string;
      decorators: "experimental" | "es";
      compilerOptions?: Partial<ts.CompilerOptions>;
    }) => {
      const project = await getProject(
        params.decorators,
        params.compilerOptions,
      );

      const sourceFile = project.createSourceFile(
        params.filePath,
        params.fileContent,
      );

      const program = project.createProgram();

      const transpiledFile = await new Promise<string>((resolve) => {
        program.emit(sourceFile, (_, f) => {
          resolve(f);
        });
      });

      return transpiledFile;
    };

    const emitDeclarations = async (params: {
      compilerOptions: ts.CompilerOptions;
    }) => {
      const outDir = params.compilerOptions.outDir;
      if (!outDir) {
        throw new Error("declarations: missing 'outDir'");
      }

      await fs.rm(outDir, { recursive: true, force: true });

      const project = await createProject({
        tsConfigFilePath: await main.getTsConfig(),
        compilerOptions: params.compilerOptions,
      });

      const program = project.createProgram();

      program.emit(
        undefined,
        undefined,
        undefined,
        /* emitOnlyDtsFiles */ true,
      );

      if (!await fs.access(outDir).then(() => true, () => false)) {
        throw new Error(
          "declarations: TypeScript didn't emit any files",
        );
      }
    };

    return { emitDeclarations, parseFile };
  },
);
