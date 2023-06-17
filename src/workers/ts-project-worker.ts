import { WorkerBridge } from "@ncpa0cpl/node-worker-bridge";
import { createProject, ts } from "@ts-morph/bootstrap";
import { getCurrentExtension } from "./get-ext";
import { getWorkersDir } from "./get-workers-dir";

type MainThread = {
  getTsConfig(): Promise<string | undefined>;
};

export const TsProjectWorker = WorkerBridge(
  { file: `${getWorkersDir()}/ts-project-worker${getCurrentExtension()}` },
  (main: MainThread) => {
    const getProject = async (
      decorators: "experimental" | "es",
      options?: Partial<ts.CompilerOptions>
    ) => {
      return await createProject({
        tsConfigFilePath: await main.getTsConfig(),
        skipAddingFilesFromTsConfig: true,
        compilerOptions: {
          target:
            decorators === "experimental"
              ? ts.ScriptTarget.ESNext
              : ts.ScriptTarget.ES2022,
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
        params.compilerOptions
      );

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

    const emitDeclarations = async (params: {
      compilerOptions: ts.CompilerOptions;
    }) => {
      const project = await createProject({
        tsConfigFilePath: await main.getTsConfig(),
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

    return { emitDeclarations, parseFile };
  }
);
