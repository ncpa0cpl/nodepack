import { WorkerBridge } from "@ncpa0cpl/node-worker-bridge";
import { createProject, ts } from "@ts-morph/bootstrap";
import { getCurrentExtension } from "./get-ext";
import { getWorkersDir } from "./get-workers-dir";

export const TsProjectWorker = WorkerBridge(
  { file: `${getWorkersDir()}/ts-project-worker${getCurrentExtension()}` },
  () => {
    const emitDeclarations = async (params: {
      tsConfigPath?: string;
      compilerOptions: ts.CompilerOptions;
    }) => {
      const project = await createProject({
        tsConfigFilePath: params.tsConfigPath,
        compilerOptions: params.compilerOptions,
      });

      const program = project.createProgram();

      await program.emit(
        undefined,
        undefined,
        undefined,
        /* emitOnlyDtsFiles */ true
      );
    };
    const parseFile = async (params: {
      tsConfigPath?: string;
      filePath: string;
      fileContent: string;
    }) => {
      const project = await createProject({
        tsConfigFilePath: params.tsConfigPath,
        compilerOptions: {
          target: ts.ScriptTarget.ESNext,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          sourceMap: false,
          inlineSourceMap: true,
          inlineSources: true,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.NodeJs,
        },
        skipAddingFilesFromTsConfig: true,
      });

      const sourceFile = project.createSourceFile(
        params.filePath,
        params.fileContent
      );

      const program = project.createProgram();

      const transpiledFile = await new Promise<string>((resolve) => {
        program.emit(sourceFile, (_, f) => {
          resolve(f);
        });
      });

      return transpiledFile;
    };

    return { emitDeclarations, parseFile };
  }
);
