import type { BuildResult } from "esbuild";
import fs from "fs";
import { walk } from "node-os-walk";
import path from "path";
import type { BuildConfig } from ".";
import { Builder } from "./builder";
import { DeclarationBuilder } from "./declaration-builder";
import { DeclarationPathRewriter } from "./declaration-path-rewriter";
import { ExcludeFacade } from "./utilities/exclude-facade";
import { ExtensionMapper } from "./utilities/extension-mapper";
import { FormatsFacade } from "./utilities/formats-facade";
import { CacheMap } from "./utilities/info-cache";
import { isDirectory } from "./utilities/is-directory";
import { isParsable } from "./utilities/is-parsable";
import { isRealPath } from "./utilities/is-real-path";
import { PathAliasResolver } from "./utilities/path-alias-resolver";
import { getTsWorkerPool } from "./workers";

export type ProgramContext = {
  buildConfig: BuildConfig;
  pathAliases: PathAliasResolver;
  excludes: ExcludeFacade;
  formats: FormatsFacade;
  extMap: ExtensionMapper;
  tsProgram: ReturnType<typeof getTsWorkerPool>;
};

export class Program {
  context: ProgramContext;

  constructor(config: BuildConfig) {
    this.context = {
      buildConfig: config,
      pathAliases: new PathAliasResolver(config.pathAliases),
      excludes: new ExcludeFacade(config.exclude ?? []),
      formats: new FormatsFacade(config.formats ?? []),
      extMap: new ExtensionMapper(config.extMapping ?? {}),
      tsProgram: getTsWorkerPool(config.tsConfig),
    };
  }

  async transpileSource() {
    const builder = new Builder(
      this.context,
      this.context.buildConfig.srcDir,
      this.context.buildConfig.outDir
    );

    const filesForCompilation: string[] = [];
    for await (const [root, _, files] of walk(
      this.context.buildConfig.srcDir
    )) {
      for (const file of files) {
        const filePath = path.join(root, file.name);

        if (
          this.context.excludes.isNotExcluded(filePath) &&
          (isParsable(filePath) ||
            this.context.extMap.hasMapping(path.extname(filePath)))
        ) {
          filesForCompilation.push(filePath);
        }
      }
    }

    if (this.context.formats.isCjs)
      await Promise.all(
        filesForCompilation.map((file) => builder.build(file, "cjs"))
      );

    if (this.context.formats.isEsm)
      await Promise.all(
        filesForCompilation.map((file) => builder.build(file, "esm"))
      );

    if (this.context.formats.isLegacy)
      await Promise.all(
        filesForCompilation.map((file) => builder.build(file, "legacy"))
      );
  }

  async emitDeclarations() {
    const declarationBuilder = new DeclarationBuilder(
      this.context,
      this.context.buildConfig.srcDir,
      this.context.buildConfig.outDir
    );

    await declarationBuilder.build();

    if (this.context.buildConfig.pathAliases) {
      const declarationPathRewriter = new DeclarationPathRewriter(
        this.context,
        declarationBuilder.getOutDir()
      );

      await declarationPathRewriter.rewrite();
    }
  }

  async watchSource() {
    CacheMap.disableCache();

    const builder = new Builder(
      this.context,
      this.context.buildConfig.srcDir,
      this.context.buildConfig.outDir
    );

    const startWatchingSourceFile = async (file: string) => {
      if (await isRealPath(file))
        return Promise.all(
          [
            this.context.formats.isCjs && builder.watch(file, "cjs"),
            this.context.formats.isEsm && builder.watch(file, "esm"),
            this.context.formats.isLegacy && builder.watch(file, "legacy"),
          ].filter((b): b is Promise<BuildResult> => !!b)
        );

      return Promise.resolve([]);
    };

    const startWatchingDirectory = (dir: string) => {
      fs.watch(dir, {}, async (eventType, filename) => {
        if (eventType === "rename") {
          console.log("file rename detected", filename);
          onFileRename(path.resolve(dir, filename));
        }
      });
    };

    const onFileRename = async (filename: string) => {
      if (await isDirectory(filename)) {
        for await (const [root, dirs, files] of walk(filename)) {
          for (const file of files) {
            const filePath = path.join(root, file.name);

            if (
              this.context.excludes.isNotExcluded(filePath) &&
              (isParsable(filePath) ||
                this.context.extMap.hasMapping(path.extname(filePath)))
            ) {
              filesForCompilation.push(filePath);
            }
          }

          for (const dir of dirs) {
            const dirPath = path.join(root, dir.name);
            startWatchingDirectory(dirPath);
          }
        }
      } else {
        startWatchingSourceFile(filename);
      }
    };

    startWatchingDirectory(this.context.buildConfig.srcDir);

    const filesForCompilation: string[] = [];
    for await (const [root, dirs, files] of walk(
      this.context.buildConfig.srcDir
    )) {
      for (const file of files) {
        const filePath = path.join(root, file.name);

        if (
          this.context.excludes.isNotExcluded(filePath) &&
          (isParsable(filePath) ||
            this.context.extMap.hasMapping(path.extname(filePath)))
        ) {
          filesForCompilation.push(filePath);
        }
      }

      for (const dir of dirs) {
        const dirPath = path.join(root, dir.name);
        startWatchingDirectory(dirPath);
      }
    }

    await Promise.all(filesForCompilation.flatMap(startWatchingSourceFile));
  }

  close() {
    this.context.tsProgram.close();
  }
}
